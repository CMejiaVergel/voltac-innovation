"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateProjectInfo, trashProject } from "@/app/actions/projects";

/**
 * Datos de cabecera del proyecto y envio a la papelera.
 *
 * El slug no se toca aunque cambie el nombre: es la URL que el equipo ya tiene
 * guardada y compartida, y romperla por un cambio de titulo seria peor que
 * tener un slug que ya no coincide del todo.
 */
export function ProjectSettings({
  slug,
  nombre,
  empresa,
  programa,
  fragmentos,
}: {
  slug: string;
  nombre: string;
  empresa: string;
  programa: string;
  fragmentos: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [texto, setTexto] = useState("");

  function guardar(fd: FormData) {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      try {
        await updateProjectInfo(slug, fd);
        setGuardado(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={guardar} className="panel flex flex-col gap-5">
        <h2 className="kicker">Datos del proyecto</h2>

        <div>
          <label className="label" htmlFor="name">
            Nombre
          </label>
          <input id="name" name="name" defaultValue={nombre} required className="field" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="company">
              Empresa dueña del reto
            </label>
            <input id="company" name="company" defaultValue={empresa} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="program">
              Programa o convocatoria
            </label>
            <input id="program" name="program" defaultValue={programa} className="field" />
          </div>
        </div>

        <p className="text-[11px] text-[#5e7370]">
          La direccion del proyecto no cambia al renombrarlo: sigue siendo{" "}
          <code className="font-mono">/proyectos/{slug}</code>, para no romper los enlaces que el
          equipo ya tenga guardados.
        </p>

        {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
          {guardado && !pending && (
            <span className="font-mono text-[10.5px] text-accent">guardado</span>
          )}
        </div>
      </form>

      <div className="rounded-[4px] border border-[rgba(142,51,36,0.35)] bg-[rgba(142,51,36,0.07)] p-5">
        <h2 className="kicker mb-2 text-[#c98b7a]">Enviar a la papelera</h2>
        <p className="hint mb-4 max-w-[64ch]">
          El proyecto sale de la lista pero no se borra: conserva sus {fragmentos} fragmentos, su
          historial, su bibliografia y sus preguntas, y se puede restaurar entero desde la
          papelera. El borrado definitivo solo ocurre al vaciarla.
        </p>

        {confirmando ? (
          <div className="flex flex-col gap-3">
            <label className="label" htmlFor="confirmar">
              Escribe <b className="text-[#e8e3d8]">{slug}</b> para confirmar
            </label>
            <input
              id="confirmar"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={slug}
              className="field max-w-[420px] font-mono text-[12px]"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={texto !== slug || pending}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await trashProject(slug);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "No se pudo.");
                    }
                  })
                }
                className="btn btn-danger disabled:opacity-30"
              >
                Enviar a la papelera
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setConfirmando(false);
                  setTexto("");
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmando(true)}>
            Enviar a la papelera
          </button>
        )}
      </div>
    </div>
  );
}
