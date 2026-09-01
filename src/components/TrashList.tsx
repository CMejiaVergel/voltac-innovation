"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { restoreProject, deleteProjectForever } from "@/app/actions/projects";

export type TrashedProject = {
  slug: string;
  nombre: string;
  empresa: string | null;
  trashedAt: string | null;
  fragmentos: number;
  fuentes: number;
  preguntas: number;
};

/**
 * Lista de la papelera.
 *
 * El borrado definitivo exige escribir el slug. No es fricción decorativa: es
 * la unica operacion de toda la aplicacion que no tiene vuelta atras, y el
 * historial tampoco sobrevive porque se va con el proyecto.
 */
export function TrashList({ proyectos }: { proyectos: TrashedProject[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [borrando, setBorrando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  function correr(accion: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await accion();
        setBorrando(null);
        setTexto("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la accion.");
      }
    });
  }

  if (proyectos.length === 0) {
    return <p className="hint">La papelera esta vacia.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-[3px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] px-3 py-2 text-[12px] text-[#e8a99c]">
          {error}
        </p>
      )}

      {proyectos.map((p) => (
        <article
          key={p.slug}
          className="rounded-[4px] border border-[rgba(232,227,216,0.12)] bg-panel p-5"
        >
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="text-[16px] font-semibold text-[#e8e3d8]">{p.nombre}</h2>
            {p.empresa && <span className="text-[12px] text-[#8b9a97]">{p.empresa}</span>}
            <span className="flex-1" />
            {p.trashedAt && (
              <span className="font-mono text-[10px] text-[#4d5a58]">
                en la papelera desde {new Date(p.trashedAt).toLocaleDateString("es-CO")}
              </span>
            )}
          </div>

          <p className="mt-3 font-mono text-[11px] text-[#5e7370]">
            {p.fragmentos} fragmentos · {p.fuentes} fuentes · {p.preguntas} preguntas
          </p>

          {borrando === p.slug ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-[rgba(142,51,36,0.35)] pt-4">
              <p className="text-[12.5px] leading-relaxed text-[#c98b7a]">
                Esto borra el proyecto para siempre, con sus {p.fragmentos} fragmentos y todo su
                historial. No se puede deshacer. Escribe{" "}
                <b className="font-mono text-[#e8e3d8]">{p.slug}</b> para confirmar.
              </p>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={p.slug}
                autoComplete="off"
                className="field max-w-[420px] font-mono text-[12px]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={texto !== p.slug || pending}
                  onClick={() => correr(() => deleteProjectForever(p.slug))}
                  className="btn border-danger bg-danger text-white disabled:opacity-30"
                >
                  Borrar para siempre
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setBorrando(null);
                    setTexto("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => correr(() => restoreProject(p.slug))}
                className="btn btn-primary"
              >
                Restaurar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setBorrando(p.slug);
                  setTexto("");
                }}
              >
                Borrar para siempre
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
