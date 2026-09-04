"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { TemplateRow } from "@/lib/templates";
import { generateInsightsAction } from "@/app/actions/insights";

/**
 * Lanza al agente para que combine puntos y proponga insights.
 *
 * A diferencia del agente investigador, este NO busca en la web: su unica
 * fuente son los fragmentos que el equipo ya acepto. Se dice en pantalla
 * porque cambia lo que se puede esperar del resultado — no va a traer datos
 * nuevos, va a leer los que ya hay.
 */
export function InsightAgent({
  slug,
  dimensiones,
  puntos,
}: {
  slug: string;
  dimensiones: TemplateRow[];
  puntos: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  if (!abierto) {
    return (
      <button type="button" className="btn" onClick={() => setAbierto(true)}>
        Pedir insights al agente
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        setError(null);
        setHecho(null);
        startTransition(async () => {
          try {
            await generateInsightsAction(slug, fd);
            setHecho("Listo. Las propuestas quedaron abajo, marcadas para revisar.");
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "El agente no pudo terminar.");
          }
        });
      }}
      className="panel flex flex-col gap-4"
    >
      <div>
        <h3 className="kicker mb-2">Pedir insights al agente</h3>
        <p className="hint max-w-[68ch]">
          Combina los {puntos} puntos aceptados del mapa. <b>No busca en la web</b>: un hecho
          traido de fuera no habria pasado por la verificacion del equipo. Si le falta un dato
          para cerrar un insight, lo dira en «lo que no podemos afirmar» en vez de inventarlo.
          Todo lo que proponga entra marcado para revisar.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[130px_1fr]">
        <div>
          <label className="label" htmlFor="cuantos">
            Cuantos
          </label>
          <input
            id="cuantos"
            name="cuantos"
            type="number"
            min={1}
            max={8}
            defaultValue={3}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="nota">
            Indicacion para esta corrida
          </label>
          <input
            id="nota"
            name="nota"
            placeholder="Ej.: buscar tensiones entre lo que la empresa declara y lo que hace"
            className="field"
          />
        </div>
      </div>

      <div>
        <span className="label">Centrarse en estas dimensiones</span>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
          {dimensiones.map((d) => (
            <label
              key={d.id}
              className="flex items-center gap-1.5 text-[12.5px] text-[#a9b5b3]"
            >
              <input type="checkbox" name="dimensiones" value={d.id} className="accent-accent" />
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: d.color }}
              />
              {d.name}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-[#5e7370]">
          Sin marcar ninguna, usa el mapa entero.
        </p>
      </div>

      {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}
      {hecho && <p className="text-[12px] text-accent">{hecho}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Combinando…" : "Generar propuestas"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setAbierto(false)}
          disabled={pending}
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}
