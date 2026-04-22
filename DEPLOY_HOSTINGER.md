# Deploy TurnIA v1 — Hostinger VPS

> **Estado actual**: Fase 0.5 validada. Listo para arrancar Fase 1.
> **Trigger**: cuando el usuario diga "vamos a deployar turnia", retomar desde Fase 1.

---

## Contexto del VPS (validado 2026-04-08)

**Hostinger KVM 2** — `srv1564148.hstgr.cloud`
- IP pública: `31.97.167.30`
- IPv6: `2a02:4780:14:d29d::1`
- OS: Ubuntu 24.04.4 LTS (Noble Numbat), kernel 6.8.0-107
- Recursos: 2 cores, 7.8 GB RAM (6.6 GB libre), 96 GB disco (82 GB libre)
- SSH: `ssh root@31.97.167.30`

## Lo que ya corre en el VPS (NO TOCAR)

- **trading-assist** (app independiente del usuario):
  - nginx en `:80` con `server_name 31.97.167.30;`
  - SPA React en `/opt/trading-assist/frontend/dist`
  - Backend Python (gunicorn) en `127.0.0.1:8000` con 2 workers
  - DB MySQL en `127.0.0.1:3306` (PID 810, ~580 MB RAM)
  - Config nginx: `/etc/nginx/sites-enabled/trading-assist`
- **monarx-agent** en `127.0.0.1:65529` (agente seguridad Hostinger)
- **systemd-resolve** en `127.0.0.54:53`

## Lo que NO existe (instalar en Fase 1)

- Postgres (puerto `:5432` libre)
- pnpm, PM2
- Node v20 (hay v18.19.1 instalado pero **sin uso** — verificado con `ps aux | grep node` vacío y `lsof /usr/bin/node` vacío → seguro reemplazar)

## Decisiones tomadas

| Decisión | Valor | Razón |
|---|---|---|
| Puerto público TurnIA | `:8080` | trading-assist usa `:80`, evitamos colisión total con otro server block en distinto puerto |
| Backend NestJS interno | `:4000` | libre |
| Frontend Next.js interno | `:3001` | libre |
| Postgres | `:5432` | libre, no choca con MySQL |
| Node | v20 LTS via NodeSource | reemplaza el v18 (no usado) |
| URL final v1 | `http://31.97.167.30:8080/` | sin dominio aún |
| Process manager | PM2 | persistencia + restart automático |
| Reverse proxy | nginx existente, nuevo `server` block | reusa lo instalado |

## Cambios ya commiteados que el deploy necesita

Ambos en `main` del repo `albanofcalegari-glitch/turnIA`:
- `apps/api/src/main.ts`: PORT > API_PORT > 4000 + guard `NODE_ENV=production` requiere `JWT_SECRET`
- `packages/database/package.json`: script `db:deploy` → `prisma migrate deploy`
- `apps/web/src/features/booking/steps/StepDetails.tsx`: removida la promesa falsa de email de confirmación
- Phase 3 frontend de sucursales completa (registro + dashboard CRUD + flujo público con step branch)

---

## Fase 1 — Dependencias del sistema

```bash
ssh root@31.97.167.30

apt update

# Node 20 LTS (reemplaza v18 — verificado seguro)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# pnpm + PM2 globales
npm install -g pnpm@10.33.0 pm2

# Postgres 16
apt install -y postgresql-16 postgresql-contrib-16
systemctl enable --now postgresql

# Verificación
echo "── Verificación ──"
node -v          # v20.x
pnpm -v          # 10.33.0
pm2 -v
pg_isready       # accepting connections
systemctl is-active postgresql
nginx -v
```

**Validación antes de seguir**: todos los comandos del bloque `Verificación` deben responder OK. Si Postgres pide prompt interactivo, seleccionar defaults (Enter).

---

## Fase 2 — Crear DB Postgres

```bash
# Generar password fuerte (guardarla)
openssl rand -base64 32

# Crear user + DB
sudo -u postgres psql <<'EOF'
CREATE USER turnia WITH PASSWORD 'PEGAR_PASSWORD_AQUI';
CREATE DATABASE turnia_prod OWNER turnia;
GRANT ALL PRIVILEGES ON DATABASE turnia_prod TO turnia;
\c turnia_prod
GRANT ALL ON SCHEMA public TO turnia;
EOF

# Verificar conexión
psql "postgresql://turnia:TU_PASS@localhost:5432/turnia_prod" -c "SELECT 1;"
```

---

## Fase 3 — Clonar y construir TurnIA

```bash
mkdir -p /opt/turnia && cd /opt/turnia
git clone https://github.com/albanofcalegari-glitch/turnIA.git .
pnpm install --frozen-lockfile

# Generar JWT secret (guardarlo)
openssl rand -base64 48
```

Crear `/opt/turnia/apps/api/.env`:
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://turnia:TU_PASS_DB@localhost:5432/turnia_prod
JWT_SECRET=PEGAR_JWT_AQUI
CORS_ORIGINS=http://31.97.167.30:8080
```

Crear `/opt/turnia/apps/web/.env.production`:
```env
NEXT_PUBLIC_API_URL=http://31.97.167.30:8080/api/v1
```

Migrar y buildear:
```bash
cd /opt/turnia
pnpm --filter @turnia/database exec prisma generate
pnpm --filter @turnia/database exec prisma migrate deploy
pnpm build
```

**Si el build se queda sin RAM** (poco probable con 6.6G libres):
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
```

---

## Fase 4 — PM2

Crear `/opt/turnia/ecosystem.config.js`:
```js
module.exports = {
  apps: [
    {
      name: 'turnia-api',
      cwd: '/opt/turnia',
      script: 'node',
      args: 'apps/api/dist/apps/api/src/main.js',
      env: { NODE_ENV: 'production', PORT: 4000 },
      max_memory_restart: '500M',
    },
    {
      name: 'turnia-web',
      cwd: '/opt/turnia/apps/web',
      script: 'pnpm',
      args: 'start',
      env: { NODE_ENV: 'production', PORT: 3001 },
      max_memory_restart: '500M',
    },
  ],
}
```

```bash
cd /opt/turnia
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd       # ejecutar el comando que imprime
pm2 status
pm2 logs turnia-api --lines 30
pm2 logs turnia-web --lines 30

# Probar internamente antes de tocar nginx
curl -i http://127.0.0.1:4000/api/v1/
curl -I http://127.0.0.1:3001/
```

---

## Fase 5 — nginx en puerto 8080 (sin tocar trading-assist)

Crear `/etc/nginx/sites-available/turnia`:
```nginx
server {
    listen 8080;
    listen [::]:8080;
    server_name _;

    client_max_body_size 10M;

    # API NestJS
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend Next.js
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Backup nginx
cp -r /etc/nginx /etc/nginx.bak.$(date +%F)

# Activar
ln -s /etc/nginx/sites-available/turnia /etc/nginx/sites-enabled/

# Validar sintaxis ANTES de recargar
nginx -t

# Si OK:
systemctl reload nginx        # reload, no restart — no corta trading-assist

# Confirmar ambos puertos
ss -tlnp | grep nginx          # debe ver :80 y :8080
```

---

## Fase 6 — Verificar conectividad externa

Desde Windows local:
```powershell
curl -I http://31.97.167.30:8080/
curl -i http://31.97.167.30:8080/api/v1/
```

Si NO responden pero `curl 127.0.0.1:8080` desde el VPS sí → panel Hostinger → Firewall → abrir TCP 8080 inbound.

ufw está inactivo, NO activarlo todavía (riesgo de cortar SSH si se configura mal).

---

## Fase 7 — Smoke tests funcionales

En navegador:
1. `http://31.97.167.30:8080/registro` → crear cuenta nueva (probar con/sin sucursales)
2. `http://31.97.167.30:8080/dashboard` → login + crear servicio + profesional + horario
3. `http://31.97.167.30:8080/<slug>` → flujo público de reserva → confirmar turno
4. `http://31.97.167.30:8080/<slug>/cancelar` → cancelar con código
5. **Verificar trading-assist sigue vivo**: `http://31.97.167.30/dashboard` → debe cargar como antes

Logs en vivo durante pruebas:
```bash
pm2 logs --lines 50
tail -f /var/log/nginx/error.log
```

---

## Fase 8 — Rollback (si algo sale mal)

```bash
# Bajar TurnIA sin tocar trading-assist
pm2 stop turnia-api turnia-web

# Sacar server block nginx
rm /etc/nginx/sites-enabled/turnia
nginx -t && systemctl reload nginx

# Trading-assist sigue intacto
```

Re-activar:
```bash
pm2 start turnia-api turnia-web
ln -s /etc/nginx/sites-available/turnia /etc/nginx/sites-enabled/
systemctl reload nginx
```

---

## Riesgos y notas

1. **Node 18 → 20**: validado seguro (sin procesos usando v18). Si en Fase 1 algo falla, fallback es usar `nvm` y mantener ambas versiones.
2. **MySQL de trading-assist**: NO tocar. Si más adelante se hace mantenimiento del VPS, hacer `mysqldump` antes.
3. **Update pendiente del sistema**: hay 1 update no aplicado por unattended-upgrades. NO aplicar `apt upgrade` durante el deploy. Después de validar TurnIA, evaluar.
4. **JWT_SECRET**: si falta en `.env` con `NODE_ENV=production`, el proceso crashea (guard intencional en `apps/api/src/main.ts`).
5. **Sin dominio**: cuando se contrate uno y apunte a `31.97.167.30`, migrar a `:80/:443` con `server_name`, instalar `certbot`, actualizar `CORS_ORIGINS` y `NEXT_PUBLIC_API_URL`, rebuild + `pm2 restart all`.

---

## Próxima sesión: comando de retomo

Cuando el usuario diga **"vamos a deployar turnia"**:
1. Leer este archivo.
2. Confirmar el estado actual (Fase 0.5 OK, listo para Fase 1).
3. Pedirle que se conecte por SSH y arranque con el bloque de **Fase 1**.
4. Avanzar fase por fase, esperando output de validación entre cada una.
