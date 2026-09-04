"use client";

import { useState, useTransition } from "react";

import {
  colorDeTrazo,
  promedioEje,
  puntuados,
  SUBCRITERIOS,
  PROBABILIDAD,
  ASSUMPTION_STATUS_META,
  type AssumptionStatus,
} from "@/lib/enums";
import {
  addAssumption,
  assumptionToQuestion,
  deleteAssumption,
  deleteConcept,
  removeConceptSource,
  scoreConcept,
  updateAssumption,
  updateConcept,
  type CampoConcepto,
} from "@/app/actions/concepts";
import type { ConceptoVista } from "./types";

/**
 * La ficha de un concepto de solucion.
 *
 * Tres partes, en el orden en que se usan: de donde sale (las ideas de
 * Combinar), cuanto vale (los seis criterios) y de que depende (los supuestos).
 *
 * Los supuestos van ordenados por probabilidad ASCENDENTE — lo improbable
 * primero. Es al reves de lo que apetece leer y es a proposito: un supuesto muy
 * improbable del que depende un concepto atractivo es el trabajo real de la
 * etapa, y enterrarlo al final de la lista seria esconderlo.
 */
export function ConceptCard({
  concepto,
  numero,
  editable,
  resaltado,
  onResaltar,
}: {
  concepto: ConceptoVista;
  numero: number;
  editable: boolean;
  resaltado: boolean;
  onResaltar: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [supuestoNuevo, setSupuestoNuevo] = useState("");

  const color = colorDeTrazo(concepto.color, concepto.position);
  const imp = promedioEje(concepto, "impacto");
  const fit = promedioEje(concepto, "fit");
  const n = puntuados(concepto);

  const supuestos = [...concepto.supuestos].sort((a, b) => {
    // Lo abierto e improbable arriba: es lo que hay que ir a verificar.
    if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
    return a.likelihood - b.likelihood;
  });
  const criticos = supuestos.filter((s) => s.status === "OPEN" && s.likelihood <= 2).length;
  const huerfanos = concepto.origenes.filter((o) => o.huerfano).length;

  function correr(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  const guardar = (campo: CampoConcepto, valor: string) => {
    if (valor === concepto[campo]) return;
    correr(() => updateConcept(concepto.id, { [campo]: valor }));
  };

  return (
    <article
      className="panel flex flex-col gap-4"
      style={{
        borderLeft: `3px solid ${color}`,
        boxShadow: resaltado ? `0 0 0 1px ${color}` : undefined,
      }}
    >
      {/* ── Cabecera ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onResaltar}
          className="grid h-[19px] w-[19px] flex-none place-items-center rounded-full font-mono text-[10px] font-bold text-[#12181B]"
          style={{ background: color }}
          title="Señalarlo en la matriz"
        >
          {numero}
        </button>

        {editable && (
          <label
            className="relative grid h-[18px] w-[18px] cursor-pointer place-items-center rounded-full transition hover:bg-[rgba(232,227,216,0.1)]"
            title="Color en la matriz"
          >
            <span
              className="block h-[11px] w-[11px] rounded-full ring-1 ring-[rgba(232,227,216,0.35)]"
              style={{ background: color }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => guardar("color", e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={`Color del concepto ${numero}`}
            />
          </label>
        )}

        <span className="flex-1" />

        {imp !== null && fit !== null && (
          <span className="font-mono text-[10px] text-[#7d8a88] [font-variant-numeric:tabular-nums]">
            imp {imp.toFixed(1)} · fit {fit.toFixed(1)}
          </span>
        )}

        {editable && (
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="rounded-[3px] border border-[rgba(232,227,216,0.18)] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-[#8b9a97] transition hover:border-[rgba(111,191,178,0.5)] hover:text-accent"
          >
            {editando ? "listo" : "editar"}
          </button>
        )}
      </div>

      {/* ── Nombre y frase ─────────────────────────────────────────────── */}
      {editable && editando ? (
        <div className="flex flex-col gap-2">
          <input
            defaultValue={concepto.title}
            onBlur={(e) => guardar("title", e.target.value)}
            placeholder="Nombre corto del concepto"
            className="field text-[15px] font-semibold"
          />
          <textarea
            defaultValue={concepto.statement}
            onBlur={(e) => guardar("statement", e.target.value)}
            rows={3}
            placeholder="Que es, en una frase."
            className="field resize-y text-[13px]"
          />
          <textarea
            defaultValue={concepto.description}
            onBlur={(e) => guardar("description", e.target.value)}
            rows={4}
            placeholder="Como funcionaria, que hace falta."
            className="field resize-y text-[12.5px]"
          />
        </div>
      ) : (
        <div>
          <h3 className="text-[16px] font-semibold leading-snug text-[#e8e3d8]">
            {concepto.title}
          </h3>
          {concepto.statement && (
            <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-[#a9b5b3]">
              {concepto.statement}
            </p>
          )}
        </div>
      )}

      {/* ── Avisos ─────────────────────────────────────────────────────── */}
      {(n < SUBCRITERIOS.length || huerfanos > 0) && (
        <ul className="flex flex-col gap-1 rounded-[4px] border border-dashed border-[rgba(201,162,39,0.4)] p-2.5">
          {n < SUBCRITERIOS.length && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              {n} de {SUBCRITERIOS.length} criterios puntuados. Su sitio en la matriz puede
              moverse con los que faltan.
            </li>
          )}
          {huerfanos > 0 && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              {huerfanos} idea{huerfanos === 1 ? "" : "s"} de origen ya no existe en Combinar.
              El texto se conserva, pero conviene revisarlo.
            </li>
          )}
        </ul>
      )}

      {/* ── Puntuacion ─────────────────────────────────────────────────── */}
      <div>
        <p className="kicker mb-2">Priorizacion</p>
        <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
          {(["impacto", "fit"] as const).map((eje) => (
            <div key={eje} className="flex flex-col gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5e7370]">
                {eje}
              </span>
              {SUBCRITERIOS.filter((s) => s.eje === eje).map((s) => (
                <div key={s.campo} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#a9b5b3]">
                    {s.label}
                  </span>
                  <span className="flex flex-none gap-[3px]">
                    {[1, 2, 3, 4, 5].map((v) => {
                      const puesto = concepto[s.campo] >= v;
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={!editable || pending}
                          // Volver a pulsar el valor actual lo despuntua: es la
                          // unica forma de decir "aun no lo hemos mirado".
                          onClick={() =>
                            correr(() =>
                              scoreConcept(
                                concepto.id,
                                s.campo,
                                concepto[s.campo] === v ? 0 : v,
                              ),
                            )
                          }
                          title={`${s.label}: ${v} de 5`}
                          aria-label={`${s.label}, ${v} de 5`}
                          className="grid h-[15px] w-[13px] place-items-center disabled:cursor-default"
                        >
                          <span
                            className="block h-[11px] w-[6px] rounded-[1px] transition-all"
                            style={{
                              background: puesto ? color : "rgba(232,227,216,0.14)",
                            }}
                          />
                        </button>
                      );
                    })}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Supuestos ──────────────────────────────────────────────────── */}
      <div>
        <p className="kicker mb-2">
          Que tendria que ser cierto ({supuestos.length})
          {criticos > 0 && (
            <span className="ml-2 normal-case tracking-normal text-[#c98b7a]">
              {criticos} improbable{criticos === 1 ? "" : "s"} sin verificar
            </span>
          )}
        </p>

        <ul className="flex flex-col gap-1.5">
          {supuestos.map((s) => {
            const meta = ASSUMPTION_STATUS_META[s.status as AssumptionStatus];
            const prob = PROBABILIDAD.find((p) => p.n === s.likelihood)!;
            return (
              <li key={s.id} className="group flex items-start gap-2">
                <span
                  className="mt-[5px] h-2 w-2 flex-none rounded-full"
                  style={{
                    background: s.status === "OPEN" ? prob.color : meta.color,
                    opacity: s.status === "OPEN" ? 1 : 0.5,
                  }}
                  title={s.status === "OPEN" ? prob.label : meta.label}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[12.5px] leading-snug ${
                      s.status === "REFUTED"
                        ? "text-[#7d8a88] line-through"
                        : "text-[#cbd4d2]"
                    }`}
                  >
                    {s.text}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[9px] uppercase tracking-[0.07em] text-[#5e7370]">
                    <span style={{ color: s.status === "OPEN" ? prob.color : meta.color }}>
                      {s.status === "OPEN" ? prob.label : meta.label}
                    </span>
                    {s.questionId && <span>· en el banco de preguntas</span>}
                  </p>
                  {s.note && (
                    <p className="mt-0.5 text-[11px] leading-snug text-[#8b9a97]">{s.note}</p>
                  )}
                </div>

                {editable && (
                  <span className="flex flex-none items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    <select
                      value={s.likelihood}
                      onChange={(e) =>
                        correr(() =>
                          updateAssumption(s.id, { likelihood: Number(e.target.value) }),
                        )
                      }
                      title="Que tan probable es"
                      className="rounded-[3px] border border-[rgba(232,227,216,0.18)] bg-[#1b2225] px-1 py-0.5 font-mono text-[9px] text-[#a9b5b3] outline-none"
                    >
                      {PROBABILIDAD.map((p) => (
                        <option key={p.n} value={p.n}>
                          {p.n}
                        </option>
                      ))}
                    </select>
                    <select
                      value={s.status}
                      onChange={(e) =>
                        correr(() => updateAssumption(s.id, { status: e.target.value }))
                      }
                      title="Estado"
                      className="rounded-[3px] border border-[rgba(232,227,216,0.18)] bg-[#1b2225] px-1 py-0.5 font-mono text-[9px] uppercase text-[#a9b5b3] outline-none"
                    >
                      {(Object.keys(ASSUMPTION_STATUS_META) as AssumptionStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {ASSUMPTION_STATUS_META[k].label}
                        </option>
                      ))}
                    </select>
                    {!s.questionId && (
                      <button
                        type="button"
                        onClick={() => {
                          const quien = window.prompt(
                            "¿Quien resuelve esta pregunta? (Cabot, equipo, asesor…)",
                            "Equipo Voltac",
                          );
                          if (quien !== null) {
                            correr(() => assumptionToQuestion(s.id, quien));
                          }
                        }}
                        title="Mandarlo al banco de preguntas"
                        className="px-1 font-mono text-[9px] uppercase text-[#5e7370] hover:text-accent"
                      >
                        preguntar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => correr(() => deleteAssumption(s.id))}
                      className="px-1 text-[13px] leading-none text-[#5e7370] hover:text-[#c98b7a]"
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {editable && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = supuestoNuevo.trim();
              if (!t) return;
              setSupuestoNuevo("");
              correr(() => addAssumption(concepto.id, t));
            }}
            className="mt-2 flex gap-2"
          >
            <input
              value={supuestoNuevo}
              onChange={(e) => setSupuestoNuevo(e.target.value)}
              placeholder="Para que esto funcione, tendria que ser cierto que…"
              className="field flex-1 text-[12.5px]"
            />
            <button type="submit" className="btn" disabled={pending || !supuestoNuevo.trim()}>
              Añadir
            </button>
          </form>
        )}
      </div>

      {/* ── Origen y desarrollo ────────────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="kicker transition hover:text-accent"
        >
          {abierto ? "Ocultar el origen" : `Ver de donde sale (${concepto.origenes.length})`}
        </button>

        {abierto && (
          <div className="mt-3 flex flex-col gap-3">
            {concepto.description && !editando && (
              <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-[#a9b5b3]">
                {concepto.description}
              </p>
            )}
            <ul className="flex flex-col gap-1.5">
              {concepto.origenes.map((o) => (
                <li key={o.id} className="group flex items-start gap-2">
                  <span
                    className="mt-[5px] h-2 w-2 flex-none rounded-full"
                    style={{ background: o.huerfano ? "#8E3324" : "#5e7370" }}
                  />
                  <p
                    className={`min-w-0 flex-1 text-[12px] leading-snug ${
                      o.huerfano ? "text-[#c98b7a] line-through" : "text-[#a9b5b3]"
                    }`}
                  >
                    {o.textSnapshot}
                    {o.huerfano && (
                      <span className="ml-1 font-mono text-[9px] uppercase">
                        · idea eliminada
                      </span>
                    )}
                  </p>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => correr(() => removeConceptSource(o.id))}
                      className="flex-none px-1 text-[13px] leading-none text-[#5e7370] opacity-0 transition hover:text-[#c98b7a] group-hover:opacity-100"
                      title="Desconectar esta idea"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
              {concepto.origenes.length === 0 && (
                <li className="text-[11.5px] text-[#5e7370]">
                  Sin ideas de origen. Se puede conectar alguna desde el panel de arriba.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}

      {editable && (
        <div className="border-t border-[rgba(232,227,216,0.1)] pt-3">
          <Eliminar onConfirm={() => correr(() => deleteConcept(concepto.id))} />
        </div>
      )}
    </article>
  );
}

function Eliminar({ onConfirm }: { onConfirm: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  return confirmando ? (
    <span className="flex gap-2">
      <button type="button" className="btn btn-danger" onClick={onConfirm}>
        Si, eliminar
      </button>
      <button type="button" className="btn" onClick={() => setConfirmando(false)}>
        Cancelar
      </button>
    </span>
  ) : (
    <button type="button" className="btn" onClick={() => setConfirmando(true)}>
      Eliminar concepto
    </button>
  );
}
