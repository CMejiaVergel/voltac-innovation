"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { TemplateShape } from "@/lib/templates";
import {
  ALCANCES_PLATAFORMA,
  CRITERIOS_PLATAFORMA_INICIALES,
  DESARROLLO_PLATAFORMA,
  PREGUNTAS_HISTORIA_PLATAFORMA,
} from "@/lib/gimi";
import { colorDePersona, tituloPostit } from "@/lib/v2";
import { Siguiente } from "./ui";
import {
  alternarFragmento,
  borrarPlataforma,
  crearPlataforma,
  guardarCriterios,
  guardarDesarrollo,
  guardarPlataforma,
  priorizarPlataforma,
  puntuarPlataforma,
  type Criterio,
  type Desarrollo,
} from "@/app/actions/plataformas";

export type PuntoMapa = { id: string; rowId: string; colId: string; titulo: string; text: string; hotspot: boolean; grupo: string | null };
export type PlataformaVista = {
  id: string;
  nombre: string;
  historia: string;
  alcance: string;
  seleccionada: boolean;
  priorizada: boolean;
  puntajes: Record<string, number>;
  desarrollo: Desarrollo;
  fragmentIds: string[];
  authorId: string | null;
};
export type InsightCorto = { id: string; n: number; color: string; statement: string };

type Paso = "identificar" | "priorizar" | "desarrollar";

/**
 * Paso 3 del proceso del GIMI (IMBOK pp. 51-60). En palabras del mentor:
 * «arranca identificando tendencias, luego las creas, las agrupas y
 * finalmente las calificas». Tres ejercicios cortos, uno por pantalla.
 */
export function Plataformas({
  slug,
  shape,
  puntos,
  plataformas,
  criterios,
  insights,
  editable,
}: {
  slug: string;
  shape: TemplateShape;
  puntos: PuntoMapa[];
  plataformas: PlataformaVista[];
  criterios: Criterio[];
  insights: InsightCorto[];
  editable: boolean;
}) {
  const router = useRouter();
  const priorizada = plataformas.find((p) => p.priorizada) ?? null;
  const [paso, setPaso] = useState<Paso>(priorizada ? "desarrollar" : plataformas.length ? "priorizar" : "identificar");
  const [abierta, setAbierta] = useState<string | null>(plataformas[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>, despues?: () => void) {
    setError(null);
    startTransition(async () => {
      const r = await accion();
      if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
      despues?.();
      router.refresh();
    });
  }

  const PASOS: { key: Paso; n: number; nombre: string; hecho: boolean }[] = [
    { key: "identificar", n: 1, nombre: "Identificar", hecho: plataformas.length > 0 },
    { key: "priorizar", n: 2, nombre: "Priorizar", hecho: !!priorizada },
    { key: "desarrollar", n: 3, nombre: "Desarrollar", hecho: !!priorizada && DESARROLLO_PLATAFORMA.every((b) => (priorizada.desarrollo[b.key] ?? "").trim()) },
  ];

  return (
    <div className="mt-6 pb-16">
      <ol className="mb-5 flex flex-wrap gap-2">
        {PASOS.map((p) => (
          <li key={p.key}>
            <button
              type="button"
              onClick={() => setPaso(p.key)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] ${
                paso === p.key ? "border-accent bg-[rgba(111,191,178,0.14)] text-[#e8e3d8]" : "border-[rgba(232,227,216,0.16)] text-[#a9b5b3]"
              }`}
            >
              <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold ${p.hecho ? "bg-accent text-accentDeep" : "border border-[#4d5a58]"}`}>
                {p.hecho ? "✓" : p.n}
              </span>
              {p.nombre}
            </button>
          </li>
        ))}
      </ol>

      {error && <p className="mb-3 rounded-[4px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] p-3 text-[12.5px] text-[#e8a99c]">{error}</p>}

      {paso === "identificar" && (
        <Identificar
          slug={slug}
          shape={shape}
          puntos={puntos}
          plataformas={plataformas}
          abierta={abierta}
          setAbierta={setAbierta}
          editable={editable}
          pendiente={pendiente}
          correr={correr}
        />
      )}
      {paso === "priorizar" && (
        <Priorizar slug={slug} plataformas={plataformas} criterios={criterios} editable={editable} pendiente={pendiente} correr={correr} onDesarrollar={() => setPaso("desarrollar")} />
      )}
      {paso === "desarrollar" &&
        (priorizada ? (
          <Desarrollar key={priorizada.id} slug={slug} plataforma={priorizada} insights={insights} editable={editable} pendiente={pendiente} correr={correr} />
        ) : (
          <p className="hint">Primero priorice una plataforma. Solo la priorizada se desarrolla.</p>
        ))}
    </div>
  );
}

type Correr = (a: () => Promise<{ ok: boolean; error?: string }>, despues?: () => void) => void;

// ─── 1. Identificar ──────────────────────────────────────────────────────────

function Identificar({
  slug,
  shape,
  puntos,
  plataformas,
  abierta,
  setAbierta,
  editable,
  pendiente,
  correr,
}: {
  slug: string;
  shape: TemplateShape;
  puntos: PuntoMapa[];
  plataformas: PlataformaVista[];
  abierta: string | null;
  setAbierta: (id: string | null) => void;
  editable: boolean;
  pendiente: boolean;
  correr: Correr;
}) {
  const [nombre, setNombre] = useState("");
  const [soloHot, setSoloHot] = useState(false);
  const p = plataformas.find((x) => x.id === abierta) ?? null;
  const fila = (rowId: string) => shape.rows.find((r) => r.id === rowId);
  const hotspots = puntos.filter((x) => x.hotspot);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section>
        <p className="mb-3 text-[13px] leading-relaxed text-[#a9b5b3]">
          Una plataforma de crecimiento es un espacio donde la empresa quiere innovar: lo bastante amplio para muchos conceptos y lo bastante concreto para
          imaginarlo. Arranque de un punto de interés o de un tema común del mapa y súmele los fragmentos relacionados. Proponga varias y escoja las cinco que más
          resuenan.
        </p>

        <div className="flex flex-col gap-1.5">
          {plataformas.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setAbierta(x.id === abierta ? null : x.id)}
              className={`flex items-center gap-2 rounded-[6px] border px-3 py-2 text-left text-[13.5px] ${
                x.id === abierta ? "border-accent bg-[rgba(111,191,178,0.08)]" : "border-[rgba(232,227,216,0.12)]"
              }`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: x.authorId ? colorDePersona(x.authorId) : "#5e7370" }} />
              <span className="flex-1 font-semibold text-[#e8e3d8]">{x.nombre}</span>
              {x.priorizada && <span className="text-[#E8C66A]">★ priorizada</span>}
              {x.seleccionada && !x.priorizada && <span className="text-[11px] text-accent">entre las 5</span>}
              <span className="text-[11px] text-[#7f8f8c]">{x.fragmentIds.length} fragmentos</span>
            </button>
          ))}
        </div>

        {editable && (
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (nombre.trim()) correr(() => crearPlataforma(slug, nombre), () => setNombre(""));
            }}
          >
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de una plataforma nueva" className="field flex-1" />
            <button type="submit" className="btn btn-primary" disabled={pendiente || !nombre.trim()}>
              Crear
            </button>
          </form>
        )}

        {p && <EditorPlataforma key={p.id} slug={slug} p={p} editable={editable} pendiente={pendiente} correr={correr} onBorrar={() => setAbierta(null)} />}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <b className="text-[13px] text-[#e8e3d8]">El mapa organizado</b>
          <label className="flex items-center gap-1.5 text-[12px] text-[#a9b5b3]">
            <input type="checkbox" checked={soloHot} onChange={() => setSoloHot(!soloHot)} />
            Solo puntos de interés ({hotspots.length})
          </label>
          <span className="flex-1" />
          {p && <span className="text-[11.5px] text-accent">Toque un fragmento para sumarlo a «{p.nombre}»</span>}
        </div>
        {!hotspots.length && (
          <p className="mb-2 text-[12px] text-[#7f8f8c]">Aún no hay puntos de interés: márquelos con ★ desde el post-it, en el mapa.</p>
        )}
        <div className="flex flex-col gap-3">
          {shape.rows.map((r) => {
            const deFila = puntos.filter((x) => x.rowId === r.id && (!soloHot || x.hotspot));
            if (!deFila.length) return null;
            const grupos = [...new Set(deFila.map((x) => x.grupo ?? ""))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
            return (
              <div key={r.id}>
                <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-[#e8e3d8]">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                  {r.name}
                </p>
                {grupos.map((g) => (
                  <div key={g} className="mb-1.5">
                    {g && <p className="mb-0.5 text-[11px] text-[#8b9a97]">{g}</p>}
                    <div className="flex flex-wrap gap-1">
                      {deFila
                        .filter((x) => (x.grupo ?? "") === g)
                        .map((x) => {
                          const dentro = !!p?.fragmentIds.includes(x.id);
                          return (
                            <button
                              key={x.id}
                              type="button"
                              disabled={!p || !editable || pendiente}
                              title={x.text}
                              onClick={() => p && correr(() => alternarFragmento(slug, p.id, x.id))}
                              className={`rounded-[3px] px-1.5 py-0.5 text-left text-[11.5px] text-[#1d2224] ${p && !dentro ? "opacity-60 hover:opacity-100" : ""}`}
                              style={{
                                background: `color-mix(in srgb, ${fila(x.rowId)?.color ?? "#6FBFB2"} 28%, #f4ecd6)`,
                                boxShadow: dentro ? "0 0 0 2px #6FBFB2" : undefined,
                              }}
                            >
                              {x.hotspot && <span className="mr-0.5 text-[#b8860b]">★</span>}
                              {tituloPostit(x)}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EditorPlataforma({
  slug,
  p,
  editable,
  pendiente,
  correr,
  onBorrar,
}: {
  slug: string;
  p: PlataformaVista;
  editable: boolean;
  pendiente: boolean;
  correr: Correr;
  onBorrar: () => void;
}) {
  const [d, setD] = useState({ nombre: p.nombre, historia: p.historia, alcance: p.alcance });
  const cambiado = d.nombre !== p.nombre || d.historia !== p.historia || d.alcance !== p.alcance;
  return (
    <form
      className="mt-4 flex flex-col gap-3 rounded-[8px] border border-[rgba(232,227,216,0.14)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        correr(() => guardarPlataforma(slug, p.id, d));
      }}
    >
      <fieldset disabled={!editable} className="flex flex-col gap-3">
        <label className="block">
          <span className="label">Nombre</span>
          <input value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} className="field text-[15px] font-semibold" placeholder="Llamativo y que todos entiendan" />
        </label>
        <div>
          <span className="label">¿Dónde queda respecto al negocio principal?</span>
          <div className="flex flex-col gap-1">
            {ALCANCES_PLATAFORMA.map((a) => (
              <label key={a.key} className="flex items-center gap-2 text-[12.5px] text-[#c9d1cf]">
                <input type="radio" name={`alcance-${p.id}`} checked={d.alcance === a.key} onChange={() => setD({ ...d, alcance: a.key })} />
                {a.label}
              </label>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="label">La historia de la plataforma</span>
          <textarea value={d.historia} onChange={(e) => setD({ ...d, historia: e.target.value })} rows={6} className="field resize-y leading-relaxed" placeholder={PREGUNTAS_HISTORIA_PLATAFORMA.join("\n")} />
        </label>
        <label className="flex items-center gap-2 text-[12.5px] text-[#c9d1cf]">
          <input type="checkbox" checked={p.seleccionada} disabled={pendiente} onChange={() => correr(() => guardarPlataforma(slug, p.id, { seleccionada: !p.seleccionada }))} />
          Entre las cinco que más resuenan con la organización
        </label>
      </fieldset>
      {editable && (
        <div className="flex items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={pendiente || !cambiado || !d.nombre.trim()}>
            Guardar
          </button>
          <span className="flex-1" />
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => confirm(`¿Borrar la plataforma «${p.nombre}»? Los fragmentos se quedan en el mapa.`) && correr(() => borrarPlataforma(slug, p.id), onBorrar)}
          >
            Borrar
          </button>
        </div>
      )}
    </form>
  );
}

// ─── 2. Priorizar ────────────────────────────────────────────────────────────

function Priorizar({
  slug,
  plataformas,
  criterios,
  editable,
  pendiente,
  correr,
  onDesarrollar,
}: {
  slug: string;
  plataformas: PlataformaVista[];
  criterios: Criterio[];
  editable: boolean;
  pendiente: boolean;
  correr: Correr;
  onDesarrollar: () => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const enJuego = plataformas.some((p) => p.seleccionada) ? plataformas.filter((p) => p.seleccionada) : plataformas;
  const total = (p: PlataformaVista) => criterios.reduce((s, c) => s + (p.puntajes[c.id] ?? 0), 0);
  const ordenadas = useMemo(() => [...enJuego].sort((a, b) => total(b) - total(a)), [enJuego, criterios]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <p className="mb-3 max-w-[760px] text-[13px] leading-relaxed text-[#a9b5b3]">
        Defina los criterios, califique cada plataforma de 1 (bajo) a 5 (alto) y priorice una. La de mayor puntaje es la candidata; el equipo decide.
        {plataformas.some((p) => p.seleccionada) ? " Se califican las cinco seleccionadas." : ""}
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-semibold text-[#e8e3d8]">Criterios</span>
        {criterios.map((c) => (
          <span key={c.id} className="flex items-center gap-1 rounded-full border border-[rgba(232,227,216,0.16)] py-0.5 pl-2.5 pr-1 text-[12px] text-[#c9d1cf]">
            {c.nombre}
            {editable && (
              <button
                type="button"
                className="px-1 text-[#5e7370] hover:text-[#e8a99c]"
                aria-label={`Quitar ${c.nombre}`}
                onClick={() => correr(() => guardarCriterios(slug, criterios.filter((x) => x.id !== c.id)))}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {editable && !criterios.length && (
          <button type="button" className="btn" disabled={pendiente} onClick={() => correr(() => guardarCriterios(slug, CRITERIOS_PLATAFORMA_INICIALES))}>
            Empezar con «Atractiva» y «Accionable»
          </button>
        )}
        {editable && (
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (nuevo.trim()) correr(() => guardarCriterios(slug, [...criterios, { id: "", nombre: nuevo }]), () => setNuevo(""));
            }}
          >
            <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Otro criterio…" className="field !w-[180px] !py-1 text-[12px]" />
          </form>
        )}
      </div>

      {!enJuego.length ? (
        <p className="hint">Primero identifique plataformas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-[#8b9a97]">
                <th className="py-1.5 pr-3 font-normal">Plataforma</th>
                {criterios.map((c) => (
                  <th key={c.id} className="px-2 py-1.5 text-center font-normal">
                    {c.nombre}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-center font-normal">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((p, i) => (
                <tr key={p.id} className="border-t border-[rgba(232,227,216,0.1)]">
                  <td className="py-2 pr-3 font-semibold text-[#e8e3d8]">{p.nombre}</td>
                  {criterios.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-center">
                      <select
                        value={p.puntajes[c.id] ?? ""}
                        disabled={!editable || pendiente}
                        onChange={(e) => correr(() => puntuarPlataforma(slug, p.id, c.id, e.target.value ? Number(e.target.value) : null))}
                        className="rounded-[3px] border border-[rgba(232,227,216,0.16)] bg-transparent px-1.5 py-0.5 text-[#e8e3d8]"
                      >
                        <option value="">–</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                  <td className={`px-2 py-2 text-center text-[15px] font-semibold ${i === 0 && total(p) > 0 ? "text-[#E8C66A]" : "text-[#e8e3d8]"}`}>{total(p)}</td>
                  <td className="py-2 pl-2 text-right">
                    {editable && (
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => correr(() => priorizarPlataforma(slug, p.id), p.priorizada ? undefined : onDesarrollar)}
                        className={`rounded-full border px-3 py-1 text-[12px] ${p.priorizada ? "border-[#E8C66A] bg-[rgba(232,198,106,0.15)] text-[#E8C66A]" : "border-[rgba(232,227,216,0.2)] text-[#a9b5b3] hover:text-[#e8e3d8]"}`}
                      >
                        {p.priorizada ? "★ Priorizada" : "Priorizar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── 3. Desarrollar ──────────────────────────────────────────────────────────

function Desarrollar({
  slug,
  plataforma,
  insights,
  editable,
  pendiente,
  correr,
}: {
  slug: string;
  plataforma: PlataformaVista;
  insights: InsightCorto[];
  editable: boolean;
  pendiente: boolean;
  correr: Correr;
}) {
  const [d, setD] = useState<Desarrollo>(plataforma.desarrollo);
  useEffect(() => setD(plataforma.desarrollo), [plataforma.desarrollo]);
  const elegidos = d.insightIds ?? [];
  const resumen = DESARROLLO_PLATAFORMA.map((b) => (d[b.key] ?? "").trim()).filter(Boolean);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        correr(() => guardarDesarrollo(slug, plataforma.id, d));
      }}
      className="max-w-[860px]"
    >
      <h2 className="mb-1 text-[20px] font-semibold text-[#e8e3d8]">
        <span className="text-[#E8C66A]">★</span> {plataforma.nombre}
      </h2>
      <p className="mb-4 text-[13px] text-[#a9b5b3]">Desarróllela para que otros la entiendan: qué la impulsa, para quién, con qué, qué propone y por qué puede ganar.</p>

      <fieldset disabled={!editable} className="flex flex-col gap-5">
        {DESARROLLO_PLATAFORMA.map((b, i) => (
          <div key={b.key}>
            <p className="mb-1 text-[14px] font-semibold text-[#e8e3d8]">
              {i + 1}. {b.titulo}
            </p>
            <ul className="mb-2 list-disc pl-5 text-[12px] text-[#8b9a97]">
              {b.preguntas.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            {b.key === "insights" && insights.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {insights.map((ins) => {
                  const on = elegidos.includes(ins.id);
                  return (
                    <button
                      key={ins.id}
                      type="button"
                      title={ins.statement}
                      onClick={() => setD({ ...d, insightIds: on ? elegidos.filter((x) => x !== ins.id) : [...elegidos, ins.id] })}
                      className="flex max-w-[320px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]"
                      style={on ? { borderColor: ins.color, background: `${ins.color}2e`, color: "#e8e3d8" } : { borderColor: "rgba(232,227,216,0.16)", color: "#a9b5b3" }}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: ins.color }} />
                      <span className="truncate">
                        {ins.n} · {ins.statement}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <textarea value={d[b.key] ?? ""} onChange={(e) => setD({ ...d, [b.key]: e.target.value })} rows={b.key === "propuesta" ? 2 : 3} className="field resize-y leading-relaxed" />
          </div>
        ))}
      </fieldset>

      {editable && (
        <button type="submit" className="btn btn-primary mt-4" disabled={pendiente}>
          Guardar
        </button>
      )}

      {resumen.length > 0 && (
        <div className="mt-6 rounded-[8px] border border-[rgba(232,198,106,0.35)] p-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#E8C66A]">La plataforma en un párrafo</p>
          <p className="text-[14px] leading-relaxed text-[#e8e3d8]">{resumen.join(" ")}</p>
        </div>
      )}

      <div className="mt-6">
        <Siguiente href={`/proyectos/${slug}/combinar`} label="Armar conceptos dentro de esta plataforma" />
      </div>
    </form>
  );
}
