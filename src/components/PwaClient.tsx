"use client";

import { useEffect, useState } from "react";

import { savePushSubscription, removePushSubscription } from "@/app/actions/push";

/**
 * Registro del service worker y gestion de las notificaciones.
 *
 * El registro es silencioso. El permiso de notificaciones NO se pide al entrar:
 * un navegador que ve una peticion de permisos sin contexto la bloquea, y el
 * usuario que la rechaza no puede volver atras facilmente. Se pide solo cuando
 * la persona pulsa el interruptor, que es cuando entiende para que sirve.
 */

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sin service worker la aplicacion sigue funcionando: solo se pierde la
      // instalacion en pantalla de inicio y las notificaciones.
    });
  }, []);

  return null;
}

type State = "unsupported" | "unconfigured" | "off" | "on" | "denied" | "working";

export function NotificationToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vapidKey) return setState("unconfigured");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return setState("unsupported");
    }
    if (Notification.permission === "denied") return setState("denied");

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidKey]);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      await savePushSubscription({
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        label: navigator.userAgent.slice(0, 120),
      });
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar.");
      setState("off");
    }
  }

  async function disable() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "unconfigured") {
    return (
      <p className="hint">
        Las notificaciones no estan configuradas en el servidor. Faltan las claves VAPID —
        ver <code className="font-mono text-[11.5px]">deploy/SETUP-VPS.md</code>.
      </p>
    );
  }

  if (state === "unsupported") {
    return (
      <p className="hint">
        Este navegador no admite notificaciones push. En iPhone hay que instalar primero la
        aplicacion en la pantalla de inicio: boton Compartir → Añadir a pantalla de inicio.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="hint">
        Bloqueaste las notificaciones para este sitio. Hay que volver a permitirlas desde los
        ajustes del navegador; desde aqui ya no se puede preguntar.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => (state === "on" ? disable() : enable())}
        disabled={state === "working"}
        className={`btn ${state === "on" ? "btn-primary" : ""}`}
      >
        {state === "working"
          ? "…"
          : state === "on"
            ? "Notificaciones activadas"
            : "Activar notificaciones"}
      </button>
      <p className="hint mt-2">
        Te avisamos en este dispositivo cuando termine una corrida del agente y haya
        propuestas por revisar.
      </p>
      {error && <p className="mt-2 text-[12px] text-[#e8a99c]">{error}</p>}
    </div>
  );
}
