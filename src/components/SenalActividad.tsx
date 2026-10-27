"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Avisa al servidor en qué página está la persona: al entrar a cada ruta y
 * luego cada minuto mientras la pestaña está visible. Con eso el superadmin
 * ve quién está en línea y en qué proyecto trabajó.
 */
export function SenalActividad() {
  const ruta = usePathname();
  useEffect(() => {
    const enviar = () => {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/actividad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruta }),
        keepalive: true,
      }).catch(() => {});
    };
    enviar();
    const reloj = window.setInterval(enviar, 60_000);
    document.addEventListener("visibilitychange", enviar);
    return () => {
      window.clearInterval(reloj);
      document.removeEventListener("visibilitychange", enviar);
    };
  }, [ruta]);
  return null;
}
