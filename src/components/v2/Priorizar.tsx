"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { colorDeTrazo, promedioEje, puntuados, SUBCRITERIOS, type CampoSubcriterio } from "@/lib/enums";
import { marcarPriorizado, puntuar } from "@/app/actions/priorizar";

export type ConceptoPriorizar = {
  id: string;
  title: string;
  statement: string;
  color: string;
  priorizado: boolean;
  postits: number;
} & Record<CampoSubcriterio, number>;

const LADO = 360;
const M = 34;
const UTIL = LADO - M * 2;
const x = (v: number) => M + ((v - 1) / 4) * UTIL;
const y = (v: number) => M + UTIL - ((v - 1) / 4) * UTIL;

const EJES = [
  { eje: "atractividad", nombre: "Atractividad", pregunta: "¿Vale la pena?" },
  { eje: "fit", nombre: "Fit", pregunta: "¿Es para nosotros?" },
] as const;

/**
 * Convergir: la matriz de priorización (mentor, 15-oct-2026: «los conceptos 1, 2
 * y 3 ubicados; se elige el n.º 1»). El equipo puntúa cada concepto, la matriz
 * los ubica y el equipo decide cuáles siguen adelante.
 */
export function Priorizar({
  slug,
  conceptos: iniciales,
  editable,
  estrategia,
}: {
  slug: string;
  conceptos: ConceptoPriorizar[];
  editable: boolean;
  /** La intención de innovar de la organización, para tenerla a la vista al puntuar el Fit. */
  estrategia: { definicion: string; restricciones: string[] } | null;
}) {
  const router = useRouter();
  const [conceptos, setConceptos] = useState(iniciales);
  const [activo, setActivo] = useState<string | null>(iniciales[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  useEffect(() => setConceptos(iniciales), [iniciales]);

  const posicion = new Map(iniciales.map((c, i) => [c.id, i]));
  const color = (c: ConceptoPriorizar) => colorDeTrazo(c.color, posicion.get(c.id) ?? 0);
  const total = (c: ConceptoPriorizar) => {
    const a = promedioEje(c, "atractividad");
    const f = promedioEje(c, "fit");
    return a !== null && f !== null ? (a + f) / 2 : null;
  };
  const ranking = [...conceptos].sort((a, b) => (total(b) ?? -1) - (total(a) ?? -1));
  const puesto = new Map(ranking.filter((c) => total(c) !== null).map((c, i) => [c.id, i + 1]));

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await accion();
      if (!r.ok) {
        setError(r.error ?? "No se pudo guardar.");
        setConceptos(iniciales);
      }
      router.refresh();
    });
  }

  function poner(id: string, campo: CampoSubcriterio, valor: number) {
    setConceptos((cs) => cs.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
    correr(() => puntuar(id, campo, valor));
  }

  function alternar(id: string, priorizado: boolean) {
    setConceptos((cs) => cs.map((c) => (c.id === id ? { ...c, priorizado } : c)));
    correr(() => marcarPriorizado(id, priorizado));
  }

  if (conceptos.length === 0) {
    return (
      <div className="panel py-10">
        <p className="text-[16px] font-semibold text-[#e8e3d8]">Aún no hay conceptos para priorizar</p>
        <p className="hint mt-1">Ármenlos primero en Combinar.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.8fr)_1.2fr]">
      {/* La matriz */}
      <div className="lg:sticky lg:top-[72px] lg:self-start">
        <div className="panel">
          <svg viewBox={`0 0 ${LADO} ${LADO}`} className="mx-auto block w-full max-w-[320px] lg:max-w-[420px]" role="img" aria-label="Matriz de priorización">
            <rect x={x(3)} y={M} width={UTIL / 2} height={UTIL / 2} fill="rgba(111,191,178,0.1)" />
            <rect x={M} y={M} width={UTIL} height={UTIL} fill="none" stroke="rgba(232,227,216,0.18)" />
            <line x1={x(3)} y1={M} x2={x(3)} y2={M + UTIL} stroke="rgba(232,227,216,0.12)" strokeDasharray="3 4" />
            <line x1={M} y1={y(3)} x2={M + UTIL} y2={y(3)} stroke="rgba(232,227,216,0.12)" strokeDasharray="3 4" />
            <text x={M + UTIL - 6} y={M + 15} textAnchor="end" style={{ fontSize: 10, fill: "#6FBFB2", letterSpacing: "0.06em" }}>
              SEGUIR
            </text>
            <text x={M + UTIL / 2} y={LADO - 8} textAnchor="middle" style={{ fontSize: 11, fill: "#a9b5b3" }}>
              Fit →
            </text>
            <text x={12} y={M + UTIL / 2} textAnchor="middle" transform={`rotate(-90 12 ${M + UTIL / 2})`} style={{ fontSize: 11, fill: "#a9b5b3" }}>
              Atractividad →
            </text>
            {conceptos.map((c) => {
              const a = promedioEje(c, "atractividad");
              const f = promedioEje(c, "fit");
              if (a === null || f === null) return null;
              const n = puesto.get(c.id);
              return (
                <g key={c.id} onClick={() => setActivo(c.id)} className="cursor-pointer">
                  <circle
                    cx={x(f)}
                    cy={y(a)}
                    r={activo === c.id ? 15 : 12}
                    fill={color(c)}
                    stroke={c.priorizado ? "#E8C66A" : "#12181b"}
                    strokeWidth={c.priorizado ? 3 : 2}
                  />
                  <text x={x(f)} y={y(a) + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "#12181b" }}>
                    {n}
                  </text>
                </g>
              );
            })}
          </svg>
          {conceptos.some((c) => total(c) === null) && (
            <p className="mt-2 text-center text-[11.5px] text-[#7f8f8c]">Los conceptos aparecen en la matriz cuando tienen puntaje en los dos ejes.</p>
          )}
        </div>
      </div>

      {/* Los conceptos */}
      <div className="flex min-w-0 flex-col gap-3">
        {conceptos.some((c) => c.priorizado) && (
          <Link href={`/proyectos/${slug}/actuar`} className="btn btn-primary self-end">
            Ir a Actuar →
          </Link>
        )}
        {error && (
          <p className="rounded-[4px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] p-3 text-[12.5px] text-[#e8a99c]">{error}</p>
        )}
        {ranking.map((c) => {
          const abierto = activo === c.id;
          const n = puesto.get(c.id);
          const t = total(c);
          return (
            <article
              key={c.id}
              className="panel transition"
              style={{ borderColor: c.priorizado ? "#E8C66A" : abierto ? "rgba(111,191,178,0.5)" : undefined }}
            >
              <button type="button" onClick={() => setActivo(abierto ? null : c.id)} className="flex w-full items-center gap-3 text-left">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold text-[#12181b]"
                  style={{ background: color(c) }}
                >
                  {n ?? "–"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[#e8e3d8]">{c.title}</span>
                  <span className="block text-[11.5px] text-[#7f8f8c]">
                    {t !== null ? `Puntaje ${t.toFixed(1)}` : `${puntuados(c)} de ${SUBCRITERIOS.length} criterios`} · {c.postits} post-its
                  </span>
                </span>
                {c.priorizado && (
                  <span className="rounded-full bg-[#E8C66A] px-2.5 py-0.5 text-[11px] font-semibold text-[#1b1f1f]">Sigue adelante</span>
                )}
              </button>

              {abierto && (
                <div className="mt-4 flex flex-col gap-4">
                  {c.statement && <p className="text-[13px] leading-relaxed text-[#c0ccca]">{c.statement}</p>}
                  {EJES.map((e) => (
                    <div key={e.eje}>
                      <p className="mb-2 text-[12.5px] font-semibold text-[#e8e3d8]">
                        {e.nombre} <span className="font-normal text-[#7f8f8c]">· {e.pregunta}</span>
                      </p>
                      {e.eje === "fit" && estrategia && (
                        <p className="mb-2 rounded-[3px] bg-[rgba(232,227,216,0.04)] px-3 py-2 text-[11.5px] leading-relaxed text-[#a9b5b3]">
                          {estrategia.definicion && <>«{estrategia.definicion}»</>}
                          {estrategia.restricciones.length > 0 && (
                            <span className="block text-[#8b9a97]">No haremos: {estrategia.restricciones.join(" · ")}</span>
                          )}
                        </p>
                      )}
                      <div className="flex flex-col gap-2">
                        {SUBCRITERIOS.filter((s) => s.eje === e.eje).map((s) => (
                          <div key={s.campo} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="min-w-[150px] flex-1 text-[12.5px] text-[#c0ccca]" title={s.ayuda}>
                              {s.label}
                            </span>
                            <span className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  disabled={!editable}
                                  onClick={() => poner(c.id, s.campo, c[s.campo] === v ? 0 : v)}
                                  className={`h-8 w-8 rounded-[4px] border text-[12.5px] transition ${
                                    c[s.campo] >= v && c[s.campo] > 0
                                      ? "border-accent bg-[rgba(111,191,178,0.25)] text-[#e8e3d8]"
                                      : "border-[rgba(232,227,216,0.14)] text-[#7f8f8c] hover:border-accent"
                                  }`}
                                  aria-label={`${s.label}: ${v}`}
                                >
                                  {v}
                                </button>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {editable && (
                    <div>
                      <button
                        type="button"
                        onClick={() => alternar(c.id, !c.priorizado)}
                        className={c.priorizado ? "btn" : "btn btn-primary"}
                      >
                        {c.priorizado ? "Ya no sigue adelante" : "★ Este sigue adelante"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
