"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DOTS_MINIMO, colorDeTrazo } from "@/lib/enums";
import { createInsight } from "@/app/actions/insights";
import { DotMap } from "./DotMap";
import { InsightCard } from "./InsightCard";
import { InsightAgent } from "./InsightAgent";
import type { CombinarProps } from "./types";

/**
 * Etapa Combinar.
 *
 * Dos modos, y la distincion importa:
 *
 *   LEER    se recorre lo ya combinado. Cada insight enciende su trazo sobre
 *           el mapa, o se ven todos a la vez para notar que zonas del mapa
 *           nadie ha tocado todavia.
 *
 *   CONECTAR se elige punto por punto y el orden queda registrado: el trazo es
 *           el razonamiento, no un adorno. Al terminar nace el insight con esos
 *           puntos y se escribe la frase.
 *
 * Se separan porque en modo leer un clic no debe cambiar nada. En un taller,
 * con el mapa proyectado, tocar un punto sin querer y crear un insight fantasma
 * es exactamente el error que hay que hacer imposible.
 */
export function CombinarBoard({ slug, shape, puntos, insights, editable }: CombinarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [modo, setModo] = useState<"leer" | "conectar">("leer");
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [resaltado, setResaltado] = useState<string | null | "todos">("todos");
  const [mostrarTextos, setMostrarTextos] = useState(false);

  const visibles = insights.filter((i) => !i.hidden);
  const propuestos = visibles.filter((i) => i.reviewState === "PROPOSED").length;

  function alternar(fragmentId: string) {
    setSeleccion((s) =>
      s.includes(fragmentId) ? s.filter((x) => x !== fragmentId) : [...s, fragmentId],
    );
  }

  function crear() {
    setError(null);
    startTransition(async () => {
      try {
        await createInsight(slug, seleccion);
        setSeleccion([]);
        setModo("leer");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear el insight.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── Barra de modo ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <div className="flex overflow-hidden rounded-[4px] border border-[rgba(232,227,216,0.2)]">
            {(["leer", "conectar"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setModo(m);
                  setSeleccion([]);
                  setError(null);
                  if (m === "conectar") {
                    setResaltado(null);
                    // Al conectar hay que LEER para decidir: los textos se
                    // encienden solos, que era el trabajo tedioso de antes.
                    setMostrarTextos(true);
                  } else {
                    setResaltado("todos");
                  }
                }}
                className={`px-3 py-1.5 text-[12px] transition ${
                  modo === m
                    ? "bg-accent font-semibold text-accentDeep"
                    : "text-[#a9b5b3] hover:bg-[rgba(232,227,216,0.06)]"
                }`}
              >
                {m === "leer" ? "Leer" : "Conectar puntos"}
              </button>
            ))}
          </div>
        )}

        {editable && puntos.length >= 4 && (
          <InsightAgent slug={slug} dimensiones={shape.rows} puntos={puntos.length} />
        )}

        <button
          type="button"
          onClick={() => setMostrarTextos((v) => !v)}
          className={`rounded-[4px] border px-3 py-1.5 text-[12px] transition ${
            mostrarTextos
              ? "border-[rgba(111,191,178,0.6)] text-accent"
              : "border-[rgba(192,204,202,0.25)] text-[#a9b5b3] hover:border-[rgba(192,204,202,0.5)]"
          }`}
        >
          {mostrarTextos ? "Ocultar textos" : "Ver textos"}
        </button>

        <span className="flex-1" />

        <span className="font-mono text-[10.5px] text-[#5e7370]">
          {puntos.length} puntos · {visibles.length} insights
          {propuestos > 0 && ` · ${propuestos} por revisar`}
        </span>
      </div>

      {/* ── Selector de trazo (modo leer) ──────────────────────────────── */}
      {modo === "leer" && visibles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip activo={resaltado === "todos"} onClick={() => setResaltado("todos")}>
            Ver todos
          </Chip>
          <Chip activo={resaltado === null} onClick={() => setResaltado(null)}>
            Ninguno
          </Chip>
          {visibles.map((i, n) => (
            <Chip
              key={i.id}
              activo={resaltado === i.id}
              color={colorDeTrazo(i.color, i.position)}
              onClick={() => setResaltado((v) => (v === i.id ? "todos" : i.id))}
            >
              Insight {n + 1}
            </Chip>
          ))}
        </div>
      )}

      {/* ── Instruccion del modo conectar ──────────────────────────────── */}
      {modo === "conectar" && (
        <div className="rounded-[4px] border border-[rgba(111,191,178,0.4)] bg-[rgba(111,191,178,0.06)] p-4">
          <p className="text-[13px] leading-relaxed text-[#cbd4d2]">
            Toca los puntos que quieres conectar. <b>El orden queda guardado</b>: es el recorrido
            del razonamiento, no un adorno. Pueden ser de columnas distintas o de la misma.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary disabled:opacity-30"
              disabled={seleccion.length < DOTS_MINIMO || pending}
              onClick={crear}
            >
              {pending
                ? "Creando…"
                : `Crear insight con ${seleccion.length} punto${seleccion.length === 1 ? "" : "s"}`}
            </button>
            {seleccion.length > 0 && (
              <button type="button" className="btn" onClick={() => setSeleccion([])}>
                Limpiar
              </button>
            )}
            {seleccion.length > 0 && seleccion.length < DOTS_MINIMO && (
              <span className="text-[11.5px] text-[#c9a94e]">
                Con un solo punto no se combina nada: hacen falta al menos {DOTS_MINIMO}.
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}

      {/* ── El mapa ────────────────────────────────────────────────────── */}
      <DotMap
        shape={shape}
        puntos={puntos}
        insights={visibles}
        seleccion={seleccion}
        onToggle={modo === "conectar" ? alternar : null}
        resaltado={modo === "conectar" ? null : resaltado}
        mostrarTextos={mostrarTextos}
      />

      {/* ── Los insights ───────────────────────────────────────────────── */}
      {visibles.length === 0 ? (
        <div className="panel">
          <p className="hint max-w-[64ch]">
            Todavia no hay insights. En esta etapa se conectan puntos del mapa —fragmentos de
            distintas dimensiones— hasta que aparece una revelacion que ninguno de ellos decia
            por separado.
            {editable && " Entra en «Conectar puntos» para empezar."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibles.map((i, n) => (
            <InsightCard
              key={i.id}
              insight={i}
              numero={n + 1}
              shape={shape}
              editable={editable}
              resaltado={resaltado === i.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  activo,
  onClick,
  color,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition ${
        activo
          ? "bg-accent font-semibold text-accentDeep"
          : "border border-[rgba(192,204,202,0.25)] text-[#a9b5b3] hover:border-[rgba(192,204,202,0.5)]"
      }`}
    >
      {color && (
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      )}
      {children}
    </button>
  );
}
