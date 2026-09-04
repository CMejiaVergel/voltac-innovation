"use client";

import { useState, useTransition } from "react";

import { duplicateProject } from "@/app/actions/projects";

/**
 * Respaldo y versionado del proyecto.
 *
 * Son las dos formas de no perder trabajo, y responden a riesgos distintos:
 *
 *   Duplicar sirve ANTES de una tanda de cambios grandes —o antes de soltarle
 *   el agente encima—: se trabaja sobre la copia y el original queda para
 *   comparar. Es rapido y no sale de la plataforma.
 *
 *   Descargar el respaldo sirve para lo otro: que la plataforma misma falle.
 *   El ZIP vive en la maquina de quien lo baja y se puede volver a importar.
 *
 * La descarga es un enlace normal y no un boton con JavaScript: asi el
 * navegador la maneja como cualquier archivo y sigue funcionando aunque la
 * pagina se quede sin hidratar.
 */
export function ProjectBackup({
  slug,
  fragmentos,
  insights,
}: {
  slug: string;
  fragmentos: number;
  insights: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState(false);
  const [sufijo, setSufijo] = useState("(copia)");
  const [incluir, setIncluir] = useState(true);

  return (
    <div className="panel flex flex-col gap-5">
      <div>
        <h2 className="kicker mb-2">Respaldo y versionado</h2>
        <p className="hint max-w-[64ch]">
          Dos redes distintas. Duplicar protege de un cambio que salga mal: se trabaja sobre la
          copia y el original queda intacto. El respaldo protege de perder la plataforma entera:
          es un archivo que se guarda fuera y se puede volver a importar.
        </p>
      </div>

      {/* ── Descargar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-[rgba(232,227,216,0.1)] pt-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="text-[13px] font-semibold text-[#e8e3d8]">Descargar respaldo</h3>
          <span className="font-mono text-[10.5px] text-[#7d8a88]">.zip</span>
        </div>
        <p className="hint max-w-[64ch]">
          Lleva el mapa completo con sus {fragmentos} fragmentos —incluidos los ocultos y los
          rechazados—, el historial de cada cambio, la bibliografia, el banco de preguntas
          {insights > 0 ? `, los ${insights} insights` : ", los insights"} y la plantilla. Adentro
          es JSON legible: se puede abrir sin la aplicacion.
        </p>
        <div>
          <a href={`/api/proyectos/${slug}/respaldo`} className="btn" download>
            Descargar respaldo completo
          </a>
        </div>
      </div>

      {/* ── Duplicar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-t border-[rgba(232,227,216,0.1)] pt-5">
        <h3 className="text-[13px] font-semibold text-[#e8e3d8]">Duplicar el proyecto</h3>
        <p className="hint max-w-[64ch]">
          Crea una copia completa con su propia direccion. Util para versionar antes de un cambio
          grande. No copia el historial ni las corridas del agente: son del proyecto donde
          ocurrieron.
        </p>

        {duplicando ? (
          <form
            action={(fd) => {
              setError(null);
              startTransition(async () => {
                try {
                  await duplicateProject(slug, fd);
                } catch (e) {
                  // redirect() lanza a proposito: no es un error que mostrar.
                  if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return;
                  setError(e instanceof Error ? e.message : "No se pudo duplicar.");
                }
              });
            }}
            className="flex flex-col gap-3"
          >
            <div>
              <label className="label" htmlFor="sufijo">
                Se añade al nombre
              </label>
              <input
                id="sufijo"
                name="sufijo"
                value={sufijo}
                onChange={(e) => setSufijo(e.target.value)}
                className="field max-w-[320px]"
                autoComplete="off"
              />
            </div>

            <label className="flex items-center gap-2 text-[12.5px] text-[#a9b5b3]">
              <input
                type="checkbox"
                name="incluirFragmentos"
                value="si"
                checked={incluir}
                onChange={(e) => setIncluir(e.target.checked)}
                className="accent-[var(--accent,#7fb3a3)]"
              />
              Copiar tambien los {fragmentos} fragmentos del mapa
            </label>
            {/* Un checkbox sin marcar no viaja en el formulario, asi que la
                accion no podria distinguir "no copiar" de "no me dijeron". */}
            {!incluir && <input type="hidden" name="incluirFragmentos" value="no" />}

            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Duplicando…" : "Duplicar"}
              </button>
              <button type="button" className="btn" onClick={() => setDuplicando(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button type="button" className="btn" onClick={() => setDuplicando(true)}>
              Duplicar el proyecto
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}
    </div>
  );
}
