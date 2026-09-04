"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { TARGET_SOLUTION_CONCEPTS } from "@/lib/gimi";
import { colorDeTrazo } from "@/lib/enums";
import { createConcept } from "@/app/actions/concepts";
import { Matriz } from "./Matriz";
import { ConceptCard } from "./ConceptCard";
import type { ConvergirProps } from "./types";

/**
 * Etapa Convergir.
 *
 * Dos modos, como en Combinar y por el mismo motivo: leer no debe poder
 * cambiar nada. En un taller, con la matriz proyectada, tocar una idea sin
 * querer y crear un concepto fantasma es el error a hacer imposible.
 *
 * La meta de 4 a 5 conceptos se avisa pero no se impone. Convergir es
 * estrechar y quince conceptos no han convergido nada — pero bloquear el
 * decimosexto obligaria a borrar antes de haber decidido, que es al reves.
 */
export function ConvergirBoard({ slug, conceptos, ideas, editable }: ConvergirProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [modo, setModo] = useState<"leer" | "construir">("leer");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [soloLibres, setSoloLibres] = useState(true);

  const visibles = conceptos.filter((c) => !c.hidden);
  const { min, max } = TARGET_SOLUTION_CONCEPTS;

  const disponibles = soloLibres ? ideas.filter((i) => !i.usada) : ideas;

  function alternar(id: string) {
    setSeleccion((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function crear() {
    setError(null);
    startTransition(async () => {
      try {
        await createConcept(slug, seleccion);
        setSeleccion([]);
        setModo("leer");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear el concepto.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── Barra de modo ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <div className="flex overflow-hidden rounded-[4px] border border-[rgba(232,227,216,0.2)]">
            {(["leer", "construir"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModo(m);
                  setSeleccion([]);
                  setError(null);
                }}
                className={`px-3 py-1.5 text-[12px] transition ${
                  modo === m
                    ? "bg-accent font-semibold text-accentDeep"
                    : "text-[#a9b5b3] hover:bg-[rgba(232,227,216,0.06)]"
                }`}
              >
                {m === "leer" ? "Leer" : "Construir concepto"}
              </button>
            ))}
          </div>
        )}

        <span className="flex-1" />

        <span className="font-mono text-[10.5px] text-[#5e7370]">
          {visibles.length} concepto{visibles.length === 1 ? "" : "s"} · {ideas.length} ideas
          disponibles
        </span>
      </div>

      {/* ── Aviso de la meta del taller ────────────────────────────────── */}
      {visibles.length > 0 && (visibles.length < min || visibles.length > max) && (
        <p className="rounded-[4px] border border-dashed border-[rgba(201,162,39,0.4)] p-2.5 text-[11.5px] leading-snug text-[#c9a94e]">
          {visibles.length < min
            ? `La meta del taller son ${min} a ${max} conceptos de solucion. Van ${visibles.length}.`
            : `Van ${visibles.length} conceptos y la meta son ${min} a ${max}. Convergir es estrechar: quiza toque fusionar algunos o dejar fuera los que no compiten de verdad.`}
        </p>
      )}

      {/* ── Construir ──────────────────────────────────────────────────── */}
      {modo === "construir" && (
        <div className="rounded-[4px] border border-[rgba(111,191,178,0.4)] bg-[rgba(111,191,178,0.06)] p-4">
          <p className="text-[13px] leading-relaxed text-[#cbd4d2]">
            Elige las ideas que componen el concepto. <b>Pueden ser varias</b>: fusionar lo
            bueno de ideas separadas es media etapa de Convergir.
          </p>

          <label className="mt-2 flex items-center gap-2 text-[12px] text-[#a9b5b3]">
            <input
              type="checkbox"
              checked={soloLibres}
              onChange={(e) => setSoloLibres(e.target.checked)}
              className="accent-accent"
            />
            Ocultar las ideas que ya usa un concepto
          </label>

          <ul className="mt-3 grid max-h-[340px] gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
            {disponibles.map((i) => {
              const marcada = seleccion.includes(i.id);
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => alternar(i.id)}
                    className={`flex w-full items-start gap-2 rounded-[3px] border p-2 text-left transition ${
                      marcada
                        ? "border-[rgba(111,191,178,0.6)] bg-[rgba(111,191,178,0.1)]"
                        : "border-[rgba(232,227,216,0.12)] hover:border-[rgba(232,227,216,0.3)]"
                    }`}
                  >
                    <span
                      className="mt-[3px] h-2 w-2 flex-none rounded-full"
                      style={{ background: i.insightColor }}
                      title={`Insight ${i.insightNumero}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] leading-snug text-[#cbd4d2]">
                        {i.text}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.07em] text-[#5e7370]">
                        Insight {i.insightNumero}
                        {i.usada && " · ya usada"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {disponibles.length === 0 && (
              <li className="text-[12px] text-[#7d8a88]">
                No quedan ideas libres. Desmarca el filtro para reutilizar alguna.
              </li>
            )}
          </ul>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary disabled:opacity-30"
              disabled={seleccion.length === 0 || pending}
              onClick={crear}
            >
              {pending
                ? "Creando…"
                : `Crear concepto con ${seleccion.length} idea${seleccion.length === 1 ? "" : "s"}`}
            </button>
            {seleccion.length > 0 && (
              <button type="button" className="btn" onClick={() => setSeleccion([])}>
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}

      {/* ── Matriz + fichas ────────────────────────────────────────────── */}
      {visibles.length === 0 ? (
        <div className="panel">
          <p className="hint max-w-[64ch]">
            Todavia no hay conceptos. En esta etapa se toman las ideas que abrieron los
            insights de Combinar y se convierten en {min} a {max} conceptos de solucion, se
            puntuan por impacto y encaje, y se lista de que supuestos dependen.
            {editable && " Entra en «Construir concepto» para empezar."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
          <div className="lg:sticky lg:top-4 lg:self-start">
            <Matriz conceptos={visibles} activo={resaltado} onActivar={setResaltado} />
          </div>

          <div className="flex flex-col gap-4">
            {visibles.map((c, n) => (
              <ConceptCard
                key={c.id}
                concepto={c}
                numero={n + 1}
                editable={editable}
                resaltado={resaltado === c.id}
                onResaltar={() => setResaltado((v) => (v === c.id ? null : c.id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Se exporta para que la pagina pueda pintar el color sin recalcularlo. */
export { colorDeTrazo };
