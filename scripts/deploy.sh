#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TurnIA — deploy incremental al VPS Hostinger
# ─────────────────────────────────────────────────────────────────────────────
#
# Diseñado para correr DENTRO del VPS, en /opt/turnia, como root.
# Es incremental: hace `git pull`, instala solo dependencias nuevas,
# corre solo migraciones nuevas, y rebuildea solo si hay cambios reales.
#
# Uso:
#   cd /opt/turnia && bash scripts/deploy.sh
#
# Lo que NO hace (intencionalmente):
#   - No toca nginx
#   - No toca el .env (las variables se editan a mano)
#   - No reinstala node/pnpm/pm2
#   - No corre seeds
#   - No deja basura si algo falla (intenta ser idempotente)
#
# Salida: 0 si OK, ≠0 si algo falló (con mensaje claro).

set -euo pipefail

# ── Colores ─────────────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GRN=$'\033[0;32m'
YEL=$'\033[0;33m'
BLU=$'\033[0;34m'
NC=$'\033[0m'

step()  { echo "${BLU}── $* ──${NC}"; }
ok()    { echo "${GRN}✓ $*${NC}"; }
warn()  { echo "${YEL}⚠ $*${NC}"; }
fail()  { echo "${RED}✗ $*${NC}" >&2; exit 1; }

# ── Pre-flight ──────────────────────────────────────────────────────────────
[[ -d /opt/turnia ]]                 || fail "No existe /opt/turnia"
cd /opt/turnia
[[ -f apps/api/.env ]]               || fail "Falta apps/api/.env (no se commitea, hay que crearlo a mano)"
# .env.production del web es CRÍTICO para que el bundle quede con la URL
# correcta de la API. Sin él, Next.js usa el default 'http://localhost:4000'
# de lib/api.ts y el frontend en producción no puede llegar al backend.
# Aprendido en el deploy 2026-04-08 — el archivo se perdió en un git stash -u
# y nadie lo notó hasta que el login fallaba con "(failed) net::ERR".
[[ -f apps/web/.env.production ]]    || fail "Falta apps/web/.env.production. Contenido esperado:
  NEXT_PUBLIC_API_URL=http://31.97.167.30:8080/api/v1
Sin esto, el bundle queda con localhost hardcoded y el login en prod no funciona."
command -v pnpm  >/dev/null 2>&1     || fail "pnpm no está en PATH"
command -v pm2   >/dev/null 2>&1     || fail "pm2 no está en PATH"
command -v git   >/dev/null 2>&1     || fail "git no está en PATH"

# Verificar que el .env tenga DATABASE_URL — pero NO sourceamos al shell padre.
# Razón: apps/api/.env contiene PORT=4000 (el puerto de la API). Si lo
# exportamos al shell que después corre `pm2 restart --update-env`, PM2 toma
# ese PORT y lo aplica al proceso turnia-web también, que entonces intenta
# bindear :4000 y entra en crash loop con EADDRINUSE. Aprendido en el deploy
# 2026-04-08 (430 restarts en 1 minuto, a las 2am). El env se carga adentro
# de una subshell solo cuando un comando lo necesita (prisma migrate).
step "Verificando apps/api/.env"
if ! grep -q '^DATABASE_URL=' apps/api/.env; then
  fail "DATABASE_URL no encontrado en apps/api/.env"
fi
ok "Env file OK"

# Aviso si hay cambios locales sin commitear (muy peligroso en prod).
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Hay cambios locales sin commitear en /opt/turnia. Continuando, pero el pull puede fallar por conflicto."
fi

# ── 1. Snapshot del HEAD actual para saber si hubo cambios ──────────────────
step "Snapshot del estado actual"
PREV_SHA=$(git rev-parse HEAD)
echo "  HEAD previo: $PREV_SHA"

# ── 2. Pull ─────────────────────────────────────────────────────────────────
step "git fetch + pull origin main"
git fetch --quiet origin main
NEW_SHA=$(git rev-parse origin/main)
echo "  HEAD remoto: $NEW_SHA"

if [[ "$PREV_SHA" == "$NEW_SHA" ]]; then
  ok "No hay commits nuevos. Nada que deployar."
  exit 0
fi

git pull --ff-only origin main
ok "Pull OK"

# ── 3. Detectar qué cambió desde el pull ────────────────────────────────────
step "Detectando cambios entre $PREV_SHA y $NEW_SHA"
CHANGED=$(git diff --name-only "$PREV_SHA" "$NEW_SHA")
echo "$CHANGED" | sed 's/^/  · /'

needs_install=0
needs_migrate=0
needs_api_build=0
needs_web_build=0
needs_prisma_gen=0

if echo "$CHANGED" | grep -qE '(^|/)(package\.json|pnpm-lock\.yaml)$'; then
  needs_install=1
fi
if echo "$CHANGED" | grep -qE '^packages/database/prisma/(schema\.prisma|migrations/)'; then
  needs_migrate=1
  needs_prisma_gen=1
fi
if echo "$CHANGED" | grep -qE '^(apps/api/|packages/(shared|database)/)'; then
  needs_api_build=1
fi
if echo "$CHANGED" | grep -qE '^(apps/web/|packages/shared/)'; then
  needs_web_build=1
fi

echo "  install:    $needs_install"
echo "  migrate:    $needs_migrate"
echo "  api build:  $needs_api_build"
echo "  web build:  $needs_web_build"

# ── 4. Install (solo si lockfile cambió) ────────────────────────────────────
if [[ $needs_install -eq 1 ]]; then
  step "pnpm install --frozen-lockfile (lockfile cambió)"
  pnpm install --frozen-lockfile
  ok "Install OK"
  # Si hubo install, regeneramos prisma client por las dudas (es barato)
  needs_prisma_gen=1
else
  ok "Sin cambios en lockfile — skip install"
fi

# ── 5. Prisma generate (si schema o install cambiaron) ──────────────────────
if [[ $needs_prisma_gen -eq 1 ]]; then
  step "prisma generate"
  pnpm --filter @turnia/database exec prisma generate
  ok "Prisma client regenerado"
fi

# ── 6. Migraciones (solo si hay nuevas) ─────────────────────────────────────
if [[ $needs_migrate -eq 1 ]]; then
  step "prisma migrate deploy (hay migraciones nuevas)"
  # Subshell aislada: el .env se sourcea acá adentro, las vars NO escapan al
  # shell padre. Esto evita que PORT=4000 (del .env de la API) contamine al
  # paso de PM2 más abajo.
  ( set -a; source apps/api/.env; set +a; pnpm --filter @turnia/database exec prisma migrate deploy )
  ok "Migraciones aplicadas"
else
  ok "Sin migraciones nuevas — skip"
fi

# ── 7. Builds ───────────────────────────────────────────────────────────────
if [[ $needs_api_build -eq 1 ]]; then
  step "build API"
  pnpm --filter @turnia/api build
  ok "API build OK"
else
  ok "Sin cambios en API — skip build"
fi

if [[ $needs_web_build -eq 1 ]]; then
  step "build Web"
  pnpm --filter @turnia/web build
  ok "Web build OK"
else
  ok "Sin cambios en Web — skip build"
fi

# ── 8. Restart PM2 (solo lo que rebuildeamos) ───────────────────────────────
# IMPORTANTE: NO usar --update-env. Eso le dice a PM2 "agarrá las vars del
# shell actual y aplicalas al proceso", lo cual puede contaminar accidentalmente
# el dump persistido si el shell tiene vars copy-pasted, exports previos, etc.
# El restart sin flag usa las env vars que ya están en el dump del proceso.
step "Restart PM2"
restarted=()
if [[ $needs_api_build -eq 1 || $needs_migrate -eq 1 ]]; then
  pm2 restart turnia-api
  restarted+=("turnia-api")
fi
if [[ $needs_web_build -eq 1 ]]; then
  pm2 restart turnia-web
  restarted+=("turnia-web")
fi

if [[ ${#restarted[@]} -eq 0 ]]; then
  warn "Nada que reiniciar (cambios solo de docs/scripts/etc)"
else
  ok "Reiniciado: ${restarted[*]}"
fi

pm2 save >/dev/null
pm2 status

# ── 9. Healthcheck ──────────────────────────────────────────────────────────
step "Healthcheck"
sleep 2
api_status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4000/api/v1/ || echo "000")
web_status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/   || echo "000")
echo "  API  127.0.0.1:4000  → HTTP $api_status"
echo "  Web  127.0.0.1:3001  → HTTP $web_status"

# Aceptamos cualquier 2xx/3xx/404 como vivo (la raíz puede no tener handler).
if [[ ! "$api_status" =~ ^(2|3|4)[0-9][0-9]$ ]]; then
  fail "API no responde — revisar 'pm2 logs turnia-api'"
fi
if [[ ! "$web_status" =~ ^(2|3|4)[0-9][0-9]$ ]]; then
  fail "Web no responde — revisar 'pm2 logs turnia-web'"
fi

ok "Deploy completo: $PREV_SHA → $NEW_SHA"
