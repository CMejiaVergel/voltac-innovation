"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import type { TemplateShape } from "@/lib/templates";
import { launchAgent } from "@/app/actions/projects";

/**
 * Seleccion del alcance de una corrida.
 *
 * Por defecto vienen marcadas las celdas poco exploradas: es donde el agente
 * aporta y donde el equipo tiene un punto ciego. Correr sobre todo el mapa es
 * posible pero caro, asi que hay que pedirlo a proposito.
 */
export function AgentLaunchForm({
  slug,
  shape,
  counts,
  thinThreshold,
  disabled,
  running,
}: {
  slug: string;
  shape: TemplateShape;
  counts: Record<string, number>;
  thinThreshold: number;
  disabled: boolean;
  running: boolean;
}) {
  const router = useRouter();

  const thinCells = shape.rows.flatMap((r) =>
    shape.cols
      .filter((c) => (counts[`${r.id}|${c.id}`] ?? 0) < thinThreshold)
      .map((c) => `${r.id}|${c.id}`),
  );

  const [checked, setChecked] = useState<Set<string>>(new Set(thinCells));

  const toggle = (key: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const all = shape.rows.flatMap((r) => shape.cols.map((c) => `${r.id}|${c.id}`));

  const action = async (formData: FormData) => {
    await launchAgent(slug, formData);
    // La corrida sigue en segundo plano: se refresca para ver el estado.
    router.refresh();
  };

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="label mb-0">Celdas a trabajar</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setChecked(new Set(all))}
            className="font-mono text-[10px] uppercase tracking-wider text-[#6f8b87] hover:text-accent"
          >
            todas
          </button>
          <button
            type="button"
            onClick={() => setChecked(new Set(thinCells))}
            className="font-mono text-[10px] uppercase tracking-wider text-[#6f8b87] hover:text-accent"
          >
            solo las vacias
          </button>
          <button
            type="button"
            onClick={() => setChecked(new Set())}
            className="font-mono text-[10px] uppercase tracking-wider text-[#6f8b87] hover:text-accent"
          >
            ninguna
          </button>
        </div>

        <div className="overflow-x-auto rounded-[3px] border border-[rgba(232,227,216,0.12)]">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="p-2 text-left font-mono text-[9.5px] uppercase tracking-wider text-[#5e7370]">
                  &nbsp;
                </th>
                {shape.cols.map((c) => (
                  <th
                    key={c.id}
                    className="p-2 text-left align-bottom text-[10.5px] font-semibold leading-tight text-[#a9b5b3]"
                  >
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shape.rows.map((r) => (
                <tr key={r.id} className="border-t border-[rgba(232,227,216,0.08)]">
                  <th className="p-2 text-left text-[10.5px] font-semibold leading-tight text-[#a9b5b3]">
                    <span
                      className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                      style={{ background: r.color }}
                    />
                    {r.name}
                  </th>
                  {shape.cols.map((c) => {
                    const key = `${r.id}|${c.id}`;
                    const n = counts[key] ?? 0;
                    const thin = n < thinThreshold;
                    return (
                      <td key={c.id} className="p-2">
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            name="cells"
                            value={key}
                            checked={checked.has(key)}
                            onChange={() => toggle(key)}
                            className="accent-[#6FBFB2]"
                          />
                          <span
                            className={`font-mono text-[10px] ${
                              thin ? "text-warn" : "text-[#5e7370]"
                            }`}
                            title={`${n} fragmentos en el mapa`}
                          >
                            {n}
                          </span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[#5e7370]">
          El numero es cuantos fragmentos aceptados hay hoy en esa celda. En ambar, las que
          tienen menos de {thinThreshold}.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div>
          <label className="label" htmlFor="perCell">
            Fragmentos por celda
          </label>
          <input
            id="perCell"
            name="perCell"
            type="number"
            min={1}
            max={10}
            defaultValue={4}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="note">
            Instruccion para esta corrida
          </label>
          <input
            id="note"
            name="note"
            className="field"
            placeholder="Ej: concentrate en plantas del corredor de Mamonal con efluentes de torre de enfriamiento"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <LaunchButton disabled={disabled || checked.size === 0} running={running} />
        <span className="font-mono text-[10.5px] text-[#5e7370]">
          {checked.size} celda{checked.size === 1 ? "" : "s"} seleccionada
          {checked.size === 1 ? "" : "s"}
        </span>
      </div>
    </form>
  );
}

function LaunchButton({ disabled, running }: { disabled: boolean; running: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={disabled || pending}>
      {running
        ? "Hay una corrida en curso…"
        : pending
          ? "Lanzando…"
          : "Investigar y proponer fragmentos"}
    </button>
  );
}
