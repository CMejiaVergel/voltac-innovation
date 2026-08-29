# Puesta en marcha en el VPS

Instrucciones para `innovation.voltac.com.co`. Se ejecutan una sola vez; los
despliegues posteriores son `./deploy/deploy.sh`.

El subdominio ya apunta al VPS (registro A, TTL 14400). Verificalo antes de
pedirle el certificado a Let's Encrypt:

```bash
dig +short innovation.voltac.com.co
```

Debe devolver la IP del VPS. Si devuelve otra cosa o nada, espera a que
propague — certbot fallara.

---

## 1. Requisitos en el servidor

```bash
node -v && npm -v && nginx -v && pm2 -v
```

Node debe ser 20 o superior. Si falta algo:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo apt install -y nginx git
sudo npm install -g pm2
```

## 2. Traer el codigo

```bash
sudo mkdir -p /var/www && sudo chown "$USER":"$USER" /var/www
git clone https://github.com/CMejiaVergel/voltac-innovation.git /var/www/voltac-innovation
cd /var/www/voltac-innovation
```

## 3. Configurar el entorno

```bash
cp .env.example .env
nano .env
```

Tres valores importan:

- `DATABASE_URL` — **ruta absoluta fuera del directorio de despliegue**, para que
  un `git pull` o un rebuild nunca la toquen:
  ```
  DATABASE_URL="file:/var/lib/voltac-innovation/prod.db"
  ```
  Crea el directorio: `sudo mkdir -p /var/lib/voltac-innovation && sudo chown "$USER":"$USER" /var/lib/voltac-innovation`

- `SESSION_SECRET` — genera uno nuevo, no reutilices el de desarrollo:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

- `ANTHROPIC_API_KEY` — la del agente investigador. Sin ella todo funciona
  salvo el llenado automatico.

Y `NODE_ENV="production"`. Con esa variable las cookies de sesion se emiten
como `secure`, asi que **solo viajan por HTTPS**: no intentes entrar por
`http://` una vez configurado.

## 4. Primer despliegue

```bash
mkdir -p /var/log/voltac-innovation
npm install --no-audit --no-fund
npx prisma migrate deploy
npm run seed          # crea plantillas, admin y el proyecto Cabot
npm run build
pm2 start deploy/ecosystem.config.js && pm2 save && pm2 startup
```

El seed lee `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` del `.env`. Cambia esa
contraseña desde Administracion apenas entres.

Comprueba que el proceso responde antes de tocar nginx:

```bash
curl -I http://127.0.0.1:3000/login
```

## 5. Nginx y certificado

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/innovation.voltac.com.co
sudo ln -s /etc/nginx/sites-available/innovation.voltac.com.co /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d innovation.voltac.com.co
```

Certbot reescribe el archivo para agregar el bloque 443 y la redireccion. La
renovacion queda automatica; verificala con `sudo certbot renew --dry-run`.

## 6. Despliegues siguientes

```bash
cd /var/www/voltac-innovation && ./deploy/deploy.sh
```

Hace respaldo de la base antes de migrar, guarda los ultimos 20 en `backups/`
y recarga PM2. Si el build falla, corta antes de tocar el proceso vivo.

---

## Respaldos

La base es un solo archivo. Un respaldo diario fuera del servidor:

```bash
crontab -e
```

```
0 3 * * * sqlite3 /var/lib/voltac-innovation/prod.db ".backup '/var/backups/voltac-innovation-$(date +\%F).db'"
```

`.backup` de sqlite3 es seguro con la aplicacion corriendo; copiar el archivo
con `cp` mientras hay una escritura en curso no lo es.

## Diagnostico

```bash
pm2 logs voltac-innovation --lines 100
sudo tail -f /var/log/nginx/voltac-innovation.error.log
```

| Sintoma | Causa habitual |
|---|---|
| 502 desde nginx | El proceso no esta arriba: `pm2 restart voltac-innovation` |
| Entra al login y vuelve al login | `NODE_ENV=production` sin HTTPS: la cookie `secure` no se guarda |
| El agente no aparece | Falta `ANTHROPIC_API_KEY`; se avisa en la pantalla del agente |
| Corridas colgadas en "Investigando" | El proceso se reinicio a mitad. Se marcan como error solas a los 25 minutos |
| `EACCES` al escribir la base | El directorio de `DATABASE_URL` no pertenece al usuario de PM2 |
