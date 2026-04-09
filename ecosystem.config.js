// ─────────────────────────────────────────────────────────────────────────────
// PM2 ecosystem para TurnIA en producción.
//
// Este archivo es la FUENTE DE VERDAD para PM2. No tiene secretos hardcoded:
// los lee de `apps/api/.env` en runtime con `loadEnv()`. Eso permite tenerlo
// commiteado en el repo público sin filtrar passwords ni JWT secrets.
//
// Uso en el VPS (cwd = /opt/turnia):
//   pm2 start ecosystem.config.js
//   pm2 save                          # persiste el dump
//   pm2 startup systemd                # arranca al boot
//
// Para reiniciar después de un deploy:
//   pm2 restart turnia-api turnia-web  # NO usar --update-env (ver nota abajo)
//
// IMPORTANTE — por qué turnia-web NO carga el `.env` de la API:
// `apps/api/.env` contiene `PORT=4000`. Si turnia-web lo cargara, intentaría
// bindear `:4000` (ya ocupado por la API) y entraría en crash loop con
// EADDRINUSE. Aprendido en producción el 2026-04-08 (430 restarts en 1 minuto).
// turnia-web declara su propio `env: { PORT: '3001' }` para evitarlo.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs')
const path = require('path')

function loadEnv(file) {
  const env = {}
  if (!fs.existsSync(file)) return env
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[m[1]] = val
  }
  return env
}

const apiEnv = loadEnv(path.join(__dirname, 'apps/api/.env'))

module.exports = {
  apps: [
    {
      name: 'turnia-api',
      cwd: '/opt/turnia',
      script: 'node',
      args: 'apps/api/dist/apps/api/src/main.js',
      // Spread + override: las vars del .env entran primero, luego forzamos
      // NODE_ENV y PORT por las dudas (PORT del .env también es 4000, pero
      // dejarlo explícito acá hace al ecosystem auto-documentado).
      env: { ...apiEnv, NODE_ENV: 'production', PORT: '4000' },
      max_memory_restart: '500M',
    },
    {
      name: 'turnia-web',
      cwd: '/opt/turnia/apps/web',
      script: 'pnpm',
      args: 'start',
      // Sin loadEnv aposta — ver nota arriba sobre EADDRINUSE.
      // NEXT_PUBLIC_API_URL se bakea en build-time desde apps/web/.env.production,
      // así que no hace falta pasarla acá.
      env: { NODE_ENV: 'production', PORT: '3001' },
      max_memory_restart: '500M',
    },
  ],
}
