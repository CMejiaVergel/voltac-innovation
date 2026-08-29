/*
 * Service worker de Voltac Innovacion.
 *
 * Deliberadamente conservador: NO cachea respuestas de la aplicacion. Los datos
 * del mapa cambian a cada rato y varias personas editan a la vez; servir una
 * copia vieja del BOM seria peor que no funcionar sin conexion. Solo cachea el
 * armazon estatico y una pagina de cortesia cuando no hay red.
 *
 * Lo que si aporta: hace la aplicacion instalable y recibe las notificaciones
 * push cuando termina una corrida del agente.
 */

const CACHE = "voltac-innovacion-v1";
const SHELL = [
  "/brand/isotipo.png",
  "/brand/icon-192.png",
  "/brand/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Estaticos con hash y assets de marca: cache primero, son inmutables.
  const isStatic =
    url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/");

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Todo lo demas: red siempre. Sin red, un aviso honesto.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            `<!doctype html><html lang="es"><head><meta charset="utf-8">
             <meta name="viewport" content="width=device-width,initial-scale=1">
             <title>Sin conexion</title>
             <style>
               body{margin:0;min-height:100vh;display:grid;place-items:center;
                    background:#12181B;color:#8b9a97;
                    font-family:Archivo,system-ui,sans-serif;text-align:center;padding:24px}
               h1{color:#e8e3d8;font-size:20px;margin:0 0 10px}
               p{margin:0;font-size:14px;line-height:1.6;max-width:34ch}
             </style></head><body><div>
             <h1>Sin conexion</h1>
             <p>El mapa vive en el servidor y varias personas lo editan a la vez,
             asi que no se guarda una copia local. Vuelve a intentarlo cuando
             recuperes la red.</p>
             </div></body></html>`,
            { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 },
          ),
      ),
    );
  }
});

// ── Notificaciones push ─────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let payload = { title: "Voltac Innovacion", body: "", url: "/proyectos" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      data: { url: payload.url },
      tag: payload.tag || "voltac-innovacion",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/proyectos";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Si ya hay una ventana de la aplicacion abierta, se reutiliza.
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
