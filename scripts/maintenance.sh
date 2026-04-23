#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────
# Toggle maintenance mode for turnIT on production.
#
# Usage (from the VPS):
#   ./scripts/maintenance.sh on    # enable  — shows maintenance page
#   ./scripts/maintenance.sh off   # disable — restores normal operation
#
# How it works:
#   ON:  Copies maintenance.html to /var/www/maintenance/ and swaps
#        the Nginx config to serve it as a static page (503).
#   OFF: Restores the original Nginx config that proxies to PM2.
#
# The API stays running during maintenance so webhook callbacks
# (Mercado Pago) are not lost. Only the user-facing frontend is
# replaced with the maintenance page.
# ──────────────────────────────────────────────────────────────────

set -euo pipefail

NGINX_CONF="/etc/nginx/sites-enabled/turnia"
MAINTENANCE_DIR="/var/www/maintenance"
MAINTENANCE_HTML="/opt/turnia/scripts/maintenance.html"
BACKUP_CONF="/etc/nginx/sites-enabled/turnia.bak"

case "${1:-}" in
  on)
    echo ">>> Activando modo mantenimiento..."
    mkdir -p "$MAINTENANCE_DIR"
    cp "$MAINTENANCE_HTML" "$MAINTENANCE_DIR/index.html"

    # Backup current config
    cp "$NGINX_CONF" "$BACKUP_CONF"

    cat > "$NGINX_CONF" <<'NGINX'
server {
    server_name turnit.com.ar www.turnit.com.ar;

    client_max_body_size 10M;

    # API stays up (webhooks, etc)
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Everything else → maintenance page
    location / {
        root /var/www/maintenance;
        try_files /index.html =503;
    }

    error_page 503 /index.html;

    listen [::]:443 ssl ipv6only=on;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/turnit.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/turnit.com.ar/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
server {
    if ($host = www.turnit.com.ar) {
        return 301 https://$host$request_uri;
    }
    if ($host = turnit.com.ar) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    listen [::]:80;
    server_name turnit.com.ar www.turnit.com.ar;
    return 404;
}
NGINX

    nginx -t && systemctl reload nginx
    echo ">>> Mantenimiento ACTIVADO. Los usuarios ven la pagina de mantenimiento."
    ;;

  off)
    echo ">>> Desactivando modo mantenimiento..."
    if [ -f "$BACKUP_CONF" ]; then
      cp "$BACKUP_CONF" "$NGINX_CONF"
      rm -f "$BACKUP_CONF"
    else
      echo "ERROR: No se encontro backup de la config Nginx ($BACKUP_CONF)"
      exit 1
    fi

    nginx -t && systemctl reload nginx
    echo ">>> Mantenimiento DESACTIVADO. Sitio operativo."
    ;;

  *)
    echo "Uso: $0 {on|off}"
    exit 1
    ;;
esac
