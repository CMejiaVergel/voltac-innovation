/**
 * PM2 — proceso de la aplicacion en el VPS.
 *
 * Uso desde el directorio del proyecto en el servidor:
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save
 *   pm2 startup          (una sola vez: arranca PM2 al reiniciar el servidor)
 *
 * PUERTO: el VPS aloja varias aplicaciones y el 3000 ya estaba ocupado. Esta
 * app usa el 3007. Si tambien lo estuviera, cambia PORT aqui y el `proxy_pass`
 * de deploy/nginx.conf: son los dos unicos lugares donde vive el numero.
 * Para comprobar que un puerto esta libre:  ss -tlnp | grep :3007
 *
 * Una sola instancia a proposito: SQLite no admite varios procesos escribiendo
 * en paralelo sin cuidado, y el agente investigador corre en segundo plano
 * dentro del proceso. Si algun dia hace falta escalar, primero se migra a
 * Postgres y se saca el agente a una cola.
 */

const PORT = process.env.APP_PORT || "3007";

module.exports = {
  apps: [
    {
      name: "voltac-innovation",
      cwd: "/var/www/voltac-innovation",
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${PORT}`,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "700M",
      env: { NODE_ENV: "production", PORT },
      error_file: "/var/log/voltac-innovation/error.log",
      out_file: "/var/log/voltac-innovation/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
