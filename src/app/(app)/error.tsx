"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Frontera de error de la aplicacion.
 *
 * Sin esto, cualquier excepcion —una accion de servidor que lanza, una consulta
 * que falla— dejaba la pantalla EN NEGRO: Next no tenia donde renderizar el
 * fallo y en produccion ademas oculta el mensaje. La persona se quedaba sin
 * saber si lo que hizo surtio efecto o no.
 *
 * El `digest` es la unica pista que produccion deja del error real, y por eso
 * se muestra: es lo que permite encontrarlo en los registros del servidor.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error de la aplicacion]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[62ch] pt-16 pb-16">
      <p className="kicker mb-2">Algo se rompio</p>
      <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#e8e3d8]">
        No se pudo completar la operacion
      </h1>

      <p className="hint mt-4">
        La accion se interrumpio. <b>Puede que si haya surtido efecto y puede que no</b>:
        vuelve a la pagina anterior y comprueba antes de repetirla.
      </p>

      {error.message && (
        <p className="mt-4 rounded-[4px] border border-[rgba(217,139,63,0.45)] bg-[rgba(217,139,63,0.12)] p-3 text-[12.5px] leading-relaxed text-warn">
          {error.message}
        </p>
      )}

      {error.digest && (
        <p className="mt-3 font-mono text-[10.5px] text-[#5e7370]">
          Referencia para los registros del servidor: {error.digest}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={reset}>
          Reintentar
        </button>
        <Link href="/proyectos" className="btn">
          Ir a proyectos
        </Link>
      </div>
    </div>
  );
}
