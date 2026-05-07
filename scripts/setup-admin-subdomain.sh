#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Setup admin.turnit.com.ar subdomain on the VPS.
#
# Prerequisites:
#   1. DNS A record for admin.turnit.com.ar → 31.97.167.30
#   2. Run as root (or sudo) from /opt/turnia
#
# What it does:
#   1. Updates nginx config to add admin subdomain server block
#   2. Updates NEXT_PUBLIC_API_URL to relative /api/v1 (works from any domain)
#   3. Adds admin.turnit.com.ar to CORS_ORIGINS
#   4. Gets SSL cert via certbot (needs DNS propagated first!)
#   5. Reloads nginx
#
# After running this, run ./scripts/deploy.sh to rebuild with new env vars.
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

NGINX_CONF="/etc/nginx/sites-enabled/turnia"
WEB_ENV="/opt/turnia/apps/web/.env.production"
API_ENV="/opt/turnia/apps/api/.env"

# ── Step 1: Backup ──
echo ">>> Backing up configs..."
cp "$NGINX_CONF" "${NGINX_CONF}.pre-admin.bak"
[ -f "$WEB_ENV" ] && cp "$WEB_ENV" "${WEB_ENV}.bak"
[ -f "$API_ENV" ] && cp "$API_ENV" "${API_ENV}.bak"

# ── Step 2: Update NEXT_PUBLIC_API_URL to relative path ──
echo ">>> Updating NEXT_PUBLIC_API_URL to /api/v1 (relative)..."
if [ -f "$WEB_ENV" ]; then
  if grep -q 'NEXT_PUBLIC_API_URL' "$WEB_ENV"; then
    sed -i 's|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=/api/v1|' "$WEB_ENV"
  else
    echo 'NEXT_PUBLIC_API_URL=/api/v1' >> "$WEB_ENV"
  fi
  echo "    Updated $WEB_ENV"
else
  echo "NEXT_PUBLIC_API_URL=/api/v1" > "$WEB_ENV"
  echo "    Created $WEB_ENV"
fi

# ── Step 3: Add admin.turnit.com.ar to CORS_ORIGINS ──
echo ">>> Updating CORS_ORIGINS..."
if [ -f "$API_ENV" ]; then
  if grep -q 'CORS_ORIGINS' "$API_ENV"; then
    CURRENT=$(grep '^CORS_ORIGINS=' "$API_ENV" | cut -d= -f2-)
    if echo "$CURRENT" | grep -q 'admin.turnit.com.ar'; then
      echo "    admin.turnit.com.ar already in CORS_ORIGINS"
    else
      sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=${CURRENT},https://admin.turnit.com.ar|" "$API_ENV"
      echo "    Added https://admin.turnit.com.ar to CORS_ORIGINS"
    fi
  else
    echo 'CORS_ORIGINS=https://turnit.com.ar,https://admin.turnit.com.ar' >> "$API_ENV"
    echo "    Added CORS_ORIGINS with both domains"
  fi
fi

# ── Step 4: SSL certificate (needs DNS already propagated) ──
echo ">>> Obtaining SSL certificate for admin.turnit.com.ar..."
echo "    (If this fails, make sure the DNS A record is propagated)"
certbot certonly --nginx -d admin.turnit.com.ar --non-interactive --agree-tos || {
  echo "!!! Certbot failed. Skipping SSL for now."
  echo "!!! Once DNS propagates, run: certbot certonly --nginx -d admin.turnit.com.ar"
  echo "!!! Then re-run this script."
  exit 1
}

# ── Step 5: Nginx config ──
echo ">>> Writing nginx config with admin subdomain..."
cat > "$NGINX_CONF" <<'NGINX'
# ── Main site: turnit.com.ar ──
server {
    server_name turnit.com.ar www.turnit.com.ar;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    listen [::]:443 ssl;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/turnit.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/turnit.com.ar/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# ── Admin subdomain: admin.turnit.com.ar ──
server {
    server_name admin.turnit.com.ar;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }

    listen [::]:443 ssl;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/admin.turnit.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.turnit.com.ar/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# ── HTTP → HTTPS redirects ──
server {
    listen 80;
    listen [::]:80;
    server_name turnit.com.ar www.turnit.com.ar admin.turnit.com.ar;
    return 301 https://$host$request_uri;
}
NGINX

echo ">>> Testing nginx config..."
nginx -t

echo ">>> Reloading nginx..."
systemctl reload nginx

echo ""
echo "=========================================="
echo "  admin.turnit.com.ar configurado!"
echo "=========================================="
echo ""
echo "Ahora ejecutá ./scripts/deploy.sh para rebuild con las nuevas env vars."
echo "/admin queda bloqueado en turnit.com.ar (404)"
echo "Solo accesible desde admin.turnit.com.ar"
