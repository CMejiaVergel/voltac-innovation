"use client";

import { useFormStatus } from "react-dom";

/** Barra fija de guardado. Vive dentro de un <form> y lee su estado de envio. */
export function SaveBar({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <div className="no-print fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(232,227,216,0.14)] bg-[rgba(18,24,27,0.96)] backdrop-blur">
      <div className="mx-auto flex max-w-[1680px] items-center gap-4 px-[18px] py-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Guardando…" : label}
        </button>
        <span className="font-mono text-[10.5px] text-[#5e7370]">
          {pending ? "Escribiendo en la base de datos" : "Los cambios no se guardan solos"}
        </span>
      </div>
    </div>
  );
}
