"use client";

import { useFormStatus } from "react-dom";

/**
 * Barra fija de guardado. Vive dentro de un <form> y lee su estado de envio.
 * En movil se apoya sobre la barra inferior de pestañas para no quedar tapada.
 */
export function SaveBar({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <div
      className="no-print fixed left-0 right-0 z-40 border-t border-[rgba(232,227,216,0.14)] bg-[rgba(18,24,27,0.96)] backdrop-blur bottom-[calc(58px+env(safe-area-inset-bottom))] md:bottom-0"
    >
      <div className="mx-auto flex max-w-[1680px] items-center gap-4 px-4 py-3 md:px-[18px]">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Guardando…" : label}
        </button>
      </div>
    </div>
  );
}
