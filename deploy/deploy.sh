#!/usr/bin/env bash
#
# Despliegue en el VPS. Se ejecuta DENTRO del servidor, en el directorio del
# proyecto:
#
#   cd /var/www/voltac-innovation && ./deploy/deploy.sh
#
# Hace: traer cambios, instalar dependencias, aplicar migraciones, construir y
# recargar PM2. Si algo falla, corta antes de tocar el proceso en produccion.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/voltac-innovation}"
PM2_APP="${PM2_APP:-voltac-innovation}"

cd "$APP_DIR"

echo "==> Rama y estado actual"
git rev-parse --abbrev-ref HEAD
git status --short

echo "==> Trayendo cambios"
git pull --ff-only

echo "==> Dependencias"
# Se instalan TAMBIEN las de desarrollo: la construccion ocurre en el servidor
# y `next build` necesita typescript, tailwind, postcss y el CLI de prisma, que
# viven en devDependencies. Omitirlas rompe el build.
npm ci --no-audit --no-fund || npm install --no-audit --no-fund

echo "==> Respaldo de la base antes de migrar"
DB_PATH="$(grep -E '^DATABASE_URL' .env | sed 's/.*file://; s/"//g')"
if [ -f "$DB_PATH" ]; then
  mkdir -p "$APP_DIR/backups"
  cp "$DB_PATH" "$APP_DIR/backups/$(date +%Y%m%d-%H%M%S).db"
  # Conservar los ultimos 20 respaldos.
  ls -1t "$APP_DIR/backups"/*.db | tail -n +21 | xargs -r rm --
  echo "    respaldo hecho"
else
  echo "    sin base previa (primer despliegue)"
fi

echo "==> Migraciones"
npx prisma generate
npx prisma migrate deploy

echo "==> Construyendo"
npm run build

echo "==> Recargando PM2"
if pm2 describe "$PM2_APP" > /dev/null 2>&1; then
  pm2 reload "$PM2_APP" --update-env
else
  pm2 start deploy/ecosystem.config.js
  pm2 save
fi

pm2 describe "$PM2_APP" | head -20
echo "==> Listo. https://innovation.voltac.com.co"
