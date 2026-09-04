"use client";

import { useState, useTransition } from "react";

import { DOT_ROLE_META, DOTS_RECOMENDADO, type DotRole } from "@/lib/enums";
import type { TemplateShape } from "@/lib/templates";
import {
  addIdea,
  deleteIdea,
  deleteInsight,
  removeDot,
  reviewInsight,
  setDotRole,
  updateIdea,
  updateInsight,
  type CampoInsight,
} from "@/app/actions/insights";
import type { InsightVista } from "./types";

/**
 * La ficha de un insight.
 *
 * Los campos son fijos y no texto libre a proposito. La estructura —hecho,
 * contraparte, las dos puntas con su evidencia— es lo que separa un insight de
 * un dato reencuadrado, y es exactamente lo que se cae primero cuando alguien
 * lo escribe con prisa. Al ser campos, la ficha puede avisar de lo que falta
 * sin tener que leer la prosa.
 *
 * Los avisos NO bloquean el guardado. La metodologia prohibe rellenar por
 * cuota, y una validacion dura empujaria a inventar una contraparte con tal de
 * poder guardar, que es peor que dejarla vacia y verla marcada.
 */

const CAMPOS: { campo: CampoInsight; label: string; ayuda: string }[] = [
  { campo: "fact", label: "El hecho", ayuda: "La necesidad o particularidad, con cifra y fuente." },
  {
    campo: "counterpart",
    label: "La contraparte",
    ayuda: "La conducta de mercado YA observada que responde a ese hecho. No una intencion.",
  },
  { campo: "shift", label: "El giro", ayuda: "Que cambia al leer las dos juntas." },
  { campo: "business", label: "El negocio", ayuda: "Que aparece cuando las dos puntas se encuentran." },
  {
    campo: "limitNote",
    label: "Lo que no podemos afirmar",
    ayuda: "Hasta donde llega la evidencia. Declararlo es parte del insight.",
  },
];

export function InsightCard({
  insight,
  shape,
  editable,
  activo,
  onVerTrazo,
}: {
  insight: InsightVista;
  shape: TemplateShape;
  editable: boolean;
  activo: boolean;
  onVerTrazo: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [ideaNueva, setIdeaNueva] = useState("");

  const propuesta = insight.reviewState === "PROPOSED";
  const faltaContraparte = !insight.counterpart.trim();
  const pocosPuntos = insight.dots.length < DOTS_RECOMENDADO;
  const huerfanos = insight.dots.filter((d) => d.huerfano).length;

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

  function guardarCampo(campo: CampoInsight, valor: string) {
    if (valor === insight[campo]) return;
    correr(() => updateInsight(insight.id, { [campo]: valor }));
  }

  return (
    <article
      className={`panel flex flex-col gap-4 transition ${
        propuesta ? "border-[rgba(224,86,127,0.45)]" : ""
      } ${activo ? "ring-1 ring-[rgba(224,86,127,0.5)]" : ""}`}
    >
      {/* ── Cabecera ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {editable ? (
          <input
            defaultValue={insight.tag}
            onBlur={(e) => guardarCampo("tag", e.target.value)}
            placeholder="etiqueta"
            className="w-[130px] rounded-[3px] border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#e0567f] outline-none hover:border-[rgba(232,227,216,0.2)] focus:border-[rgba(232,227,216,0.35)]"
          />
        ) : (
          insight.tag && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#e0567f]">
              {insight.tag}
            </span>
          )
        )}

        {propuesta && (
          <span className="rounded-[2px] bg-[rgba(224,86,127,0.2)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#e8a9bc]">
            propuesto por el agente
          </span>
        )}

        <span className="flex-1" />

        <button
          type="button"
          onClick={onVerTrazo}
          className="font-mono text-[10px] uppercase tracking-wider text-[#7d8a88] transition hover:text-accent"
        >
          {activo ? "trazo visible" : "ver trazo"}
        </button>
      </div>

      {/* ── La frase ───────────────────────────────────────────────────── */}
      {editable ? (
        <textarea
          defaultValue={insight.statement}
          onBlur={(e) => guardarCampo("statement", e.target.value)}
          rows={4}
          placeholder="La frase concluyente. Debe poder leerse sola: un hecho con cifra, y la contraparte de mercado que ya actuo."
          className="w-full resize-y rounded-[4px] border border-transparent bg-[rgba(232,227,216,0.04)] p-3 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#e8e3d8] outline-none transition hover:border-[rgba(232,227,216,0.18)] focus:border-[rgba(111,191,178,0.5)]"
        />
      ) : (
        <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#e8e3d8]">
          {insight.statement}
        </p>
      )}

      {/* ── Avisos ─────────────────────────────────────────────────────── */}
      {(faltaContraparte || pocosPuntos || huerfanos > 0) && (
        <ul className="flex flex-col gap-1 rounded-[4px] border border-dashed border-[rgba(201,162,39,0.4)] p-2.5">
          {faltaContraparte && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              Falta la contraparte de mercado. Sin ella el insight es un dato reencuadrado: no
              dice quien ya respondio a ese hecho.
            </li>
          )}
          {pocosPuntos && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              Conecta {insight.dots.length} punto{insight.dots.length === 1 ? "" : "s"}. Con{" "}
              {DOTS_RECOMENDADO} o mas suele salir un insight mas rico — pero solo si el tercero
              aporta de verdad.
            </li>
          )}
          {huerfanos > 0 && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              {huerfanos} punto{huerfanos === 1 ? "" : "s"} apunta a un fragmento que ya no esta
              en el mapa. El texto se conserva abajo, pero conviene revisarlo.
            </li>
          )}
        </ul>
      )}

      {/* ── Puntos conectados ──────────────────────────────────────────── */}
      <div>
        <p className="kicker mb-2">Puntos conectados</p>
        <ul className="flex flex-col gap-1.5">
          {[...insight.dots]
            .sort((a, b) => a.position - b.position)
            .map((d) => {
              const meta = DOT_ROLE_META[d.role];
              const fila = shape.rows.find((r) => r.id === d.rowId);
              return (
                <li key={d.id} className="group flex items-start gap-2">
                  <span
                    className="mt-[5px] h-2 w-2 flex-none rounded-full"
                    style={{ background: d.huerfano ? "#8E3324" : (fila?.color ?? meta.color) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[12px] leading-snug ${
                        d.huerfano ? "text-[#c98b7a] line-through" : "text-[#a9b5b3]"
                      }`}
                    >
                      {d.textSnapshot}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.07em] text-[#5e7370]">
                      {fila?.name ?? d.rowId} ·{" "}
                      {shape.cols.find((c) => c.id === d.colId)?.name ?? d.colId}
                      {d.huerfano && " · fragmento eliminado"}
                    </p>
                  </div>

                  {editable && (
                    <span className="flex flex-none items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <select
                        value={d.role}
                        onChange={(e) => correr(() => setDotRole(d.id, e.target.value))}
                        title={meta.help}
                        className="rounded-[3px] border border-[rgba(232,227,216,0.18)] bg-[#1b2225] px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#a9b5b3] outline-none"
                      >
                        {(Object.keys(DOT_ROLE_META) as DotRole[]).map((r) => (
                          <option key={r} value={r}>
                            {DOT_ROLE_META[r].label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => correr(() => removeDot(d.id))}
                        title="Desconectar este punto"
                        className="px-1 text-[13px] leading-none text-[#5e7370] hover:text-[#c98b7a]"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
        </ul>
      </div>

      {/* ── Desglose ───────────────────────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="kicker transition hover:text-accent"
        >
          {abierto ? "Ocultar el desglose" : "Ver el desglose"}
        </button>

        {abierto && (
          <div className="mt-3 flex flex-col gap-3">
            {CAMPOS.map(({ campo, label, ayuda }) => (
              <div key={campo}>
                <label className="label" title={ayuda}>
                  {label}
                </label>
                {editable ? (
                  <textarea
                    defaultValue={insight[campo]}
                    onBlur={(e) => guardarCampo(campo, e.target.value)}
                    rows={2}
                    placeholder={ayuda}
                    className="field resize-y text-[12.5px]"
                  />
                ) : (
                  <p className="text-[12.5px] leading-snug text-[#a9b5b3]">
                    {insight[campo] || <span className="text-[#5e7370]">—</span>}
                  </p>
                )}
              </div>
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <Punta
                titulo="Quien ofrece"
                quien={insight.offerWho}
                prueba={insight.offerProof}
                editable={editable}
                onQuien={(v) => guardarCampo("offerWho", v)}
                onPrueba={(v) => guardarCampo("offerProof", v)}
                color="#6FBFB2"
              />
              <Punta
                titulo="Quien paga"
                quien={insight.payWho}
                prueba={insight.payProof}
                editable={editable}
                onQuien={(v) => guardarCampo("payWho", v)}
                onPrueba={(v) => guardarCampo("payProof", v)}
                color="#D98B3F"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Ideas ──────────────────────────────────────────────────────── */}
      <div>
        <p className="kicker mb-2">Ideas que abre ({insight.ideas.length})</p>
        <ol className="flex flex-col gap-1.5">
          {insight.ideas.map((idea, i) => (
            <li key={idea.id} className="group flex items-start gap-2">
              <span className="mt-[3px] font-mono text-[10px] text-[#5e7370]">
                {String.fromCharCode(97 + i)}.
              </span>
              {editable ? (
                <textarea
                  defaultValue={idea.text}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== idea.text) {
                      correr(() => updateIdea(idea.id, e.target.value));
                    }
                  }}
                  rows={2}
                  className="min-w-0 flex-1 resize-y rounded-[3px] border border-transparent bg-transparent px-1.5 py-0.5 text-[12.5px] leading-snug text-[#a9b5b3] outline-none hover:border-[rgba(232,227,216,0.18)] focus:border-[rgba(111,191,178,0.5)]"
                />
              ) : (
                <p className="flex-1 text-[12.5px] leading-snug text-[#a9b5b3]">{idea.text}</p>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={() => correr(() => deleteIdea(idea.id))}
                  className="flex-none px-1 text-[13px] leading-none text-[#5e7370] opacity-0 transition hover:text-[#c98b7a] group-hover:opacity-100"
                  title="Eliminar la idea"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ol>

        {editable && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = ideaNueva.trim();
              if (!t) return;
              setIdeaNueva("");
              correr(() => addIdea(insight.id, t));
            }}
            className="mt-2 flex gap-2"
          >
            <input
              value={ideaNueva}
              onChange={(e) => setIdeaNueva(e.target.value)}
              placeholder="Una idea que abre este insight…"
              className="field flex-1 text-[12.5px]"
            />
            <button type="submit" className="btn" disabled={pending || !ideaNueva.trim()}>
              Añadir
            </button>
          </form>
        )}
      </div>

      {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}

      {/* ── Pie ────────────────────────────────────────────────────────── */}
      {editable && (
        <div className="flex flex-wrap gap-2 border-t border-[rgba(232,227,216,0.1)] pt-3">
          {propuesta ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={() => correr(() => reviewInsight(insight.id, "ACCEPT"))}
              >
                Aceptar el insight
              </button>
              <button
                type="button"
                className="btn"
                disabled={pending}
                onClick={() => correr(() => reviewInsight(insight.id, "REJECT"))}
              >
                Descartar
              </button>
            </>
          ) : (
            <Eliminar onConfirm={() => correr(() => deleteInsight(insight.id))} />
          )}
        </div>
      )}
    </article>
  );
}

function Punta({
  titulo,
  quien,
  prueba,
  editable,
  onQuien,
  onPrueba,
  color,
}: {
  titulo: string;
  quien: string;
  prueba: string;
  editable: boolean;
  onQuien: (v: string) => void;
  onPrueba: (v: string) => void;
  color: string;
}) {
  return (
    <div className="rounded-[4px] border border-[rgba(232,227,216,0.12)] p-2.5">
      <p
        className="mb-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em]"
        style={{ color }}
      >
        {titulo}
      </p>
      {editable ? (
        <>
          <textarea
            defaultValue={quien}
            onBlur={(e) => onQuien(e.target.value)}
            rows={2}
            placeholder="Quien"
            className="field mb-1.5 resize-y text-[12px]"
          />
          <textarea
            defaultValue={prueba}
            onBlur={(e) => onPrueba(e.target.value)}
            rows={2}
            placeholder="Como lo sabemos: la evidencia de que ya lo hace"
            className="field resize-y text-[11.5px]"
          />
        </>
      ) : (
        <>
          <p className="text-[12px] leading-snug text-[#a9b5b3]">{quien || "—"}</p>
          {prueba && (
            <p className="mt-1 font-mono text-[10.5px] leading-snug text-[#7d8a88]">{prueba}</p>
          )}
        </>
      )}
    </div>
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
      Eliminar insight
    </button>
  );
}
