"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { sugerirTitulos } from "@/app/actions/divergir";

/** Botón para que la IA proponga títulos a los post-its que aún no tienen. */
export function SugerirTitulos({ mapId, sinTitulo }: { mapId: string; sinTitulo: number }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  if (sinTitulo === 0 && !aviso) return null;

  return (
    <span className="flex items-center gap-2">
      {aviso && <span className="text-[11.5px] text-[#a9b5b3]">{aviso}</span>}
      {aviso?.startsWith("Falta tu clave") && (
        <a href="/cuenta" className="text-[11.5px] text-accent underline">
          Ir a Cuenta
        </a>
      )}
      {sinTitulo > 0 && (
        <button
          type="button"
          className="btn"
          disabled={pendiente}
          title="La IA propone un título corto para cada post-it sin título. Todos quedan editables."
          onClick={() =>
            start(async () => {
              setAviso(null);
              const r = await sugerirTitulos(mapId);
              setAviso(r.error ?? `${r.hechos} títulos sugeridos${r.faltan ? ` · faltan ${r.faltan}` : ""}.`);
              router.refresh();
            })
          }
        >
          {pendiente ? "Sugiriendo títulos…" : `✦ Sugerir títulos (${sinTitulo})`}
        </button>
      )}
    </span>
  );
}
