"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { importProjectBackup } from "@/app/actions/projects";

/**
 * Importar un respaldo ZIP.
 *
 * SIEMPRE entra como proyecto nuevo, y eso se dice en pantalla y no solo en el
 * codigo: quien importa un respaldo suele estar nervioso porque algo se
 * rompio, y necesita saber ANTES de pulsar que esto no puede empeorar nada.
 *
 * Va en una capa por encima y no expandido en linea porque el boton vive en la
 * fila de acciones de la cabecera, donde no cabe un formulario.
 */
export function ImportBackup() {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  function cerrar() {
    setAbierto(false);
    setArchivo(null);
    setError(null);
  }

  // Escape cierra, y al abrir el foco entra al panel para que el teclado no se
  // quede navegando la pagina de atras.
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) cerrar();
    };
    document.addEventListener("keydown", alPulsar);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierto, pending]);

  return (
    <>
      <button type="button" className="btn" onClick={() => setAbierto(true)}>
        Importar respaldo
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !pending) cerrar();
          }}
        >
          <div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Importar respaldo"
            className="panel my-auto w-full max-w-[560px] outline-none"
          >
            <form
              action={(fd) => {
                setError(null);
                startTransition(async () => {
                  try {
                    await importProjectBackup(fd);
                  } catch (e) {
                    // redirect() lanza a proposito: no es un error que mostrar.
                    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
                    setError(
                      e instanceof Error ? e.message : "No se pudo importar el respaldo.",
                    );
                  }
                });
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <h2 className="kicker mb-2">Importar respaldo</h2>
                <p className="hint">
                  Elige un archivo <code className="font-mono">.zip</code> descargado desde esta
                  plataforma. Entra{" "}
                  <b className="text-[#e8e3d8]">siempre como un proyecto nuevo</b>: no pisa ni
                  modifica ninguno de los que ya existen. Para recuperar algo se importa al lado
                  y se compara.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="archivo">
                  Archivo de respaldo
                </label>
                <input
                  id="archivo"
                  name="archivo"
                  type="file"
                  accept=".zip,application/zip"
                  required
                  onChange={(e) => {
                    setArchivo(e.target.files?.[0] ?? null);
                    setError(null);
                  }}
                  className="field file:mr-3 file:cursor-pointer file:rounded-[3px] file:border-0 file:bg-[rgba(232,227,216,0.1)] file:px-3 file:py-1.5 file:text-[11px] file:uppercase file:tracking-wider file:text-[#cbd4d2]"
                />
                {archivo && (
                  <p className="mt-2 font-mono text-[10.5px] text-[#7d8a88]">
                    {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>

              {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary disabled:opacity-40"
                  disabled={pending || !archivo}
                >
                  {pending ? "Importando…" : "Importar como proyecto nuevo"}
                </button>
                <button type="button" className="btn" onClick={cerrar} disabled={pending}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
