/**
 * PM2 — proceso de la aplicacion en el VPS.
 *
 * Uso desde el directorio del proyecto en el servidor:
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save
 *   pm2 startup          (una sola vez: arranca PM2 al reiniciar el servidor)
 *
 * Una sola instancia a proposito: SQLite no admite varios procesos escribiendo
 * en paralelo sin cuidado, y el agente investigador corre en segundo plano
 * dentro del proceso. Si algun dia hace falta escalar, primero se migra a
 * Postgres y se saca el agente a una cola.
 */
module.exports = {
  apps: [
    {
      name: "voltac-innovation",
      cwd: "/var/www/voltac-innovation",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "700M",
      env: { NODE_ENV: "production", PORT: "3000" },
      error_file: "/var/log/voltac-innovation/error.log",
      out_file: "/var/log/voltac-innovation/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
