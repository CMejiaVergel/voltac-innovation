"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { TemplateShape } from "@/lib/templates";
import { VERIFICATION_META, type Verification } from "@/lib/enums";
import { PREGUNTA_LIENZO } from "@/lib/gimi";
import { tituloPostit } from "@/lib/v2";
import {
  anclarPostit,
  borrarConcepto,
  crearConcepto,
  guardarConcepto,
  redactarConcepto,
  soltarPostit,
} from "@/app/actions/combinar";

export type PostitLienzo = {
  id: string;
  rowId: string;
  colId: string;
  titulo: string;
  text: string;
  verification: Verification;
};

export type ConceptoLienzo = {
  id: string;
  title: string;
  statement: string;
  /** fragmentId null = el post-it se borró del mapa; queda la copia del texto. */
  anclas: { fragmentId: string | null; rowId: string; texto: string }[];
};

/**
 * Lienzo de concepto (mentor, 15-oct-2026): a la izquierda el mapa, a la
 * derecha el concepto con una casilla por dimensión. Se arrastran post-its a
 * las casillas, se sueltan con «×» y vuelven al mapa. Varios conceptos en
 * paralelo, cada uno en su pestaña.
 */
export function LienzoConcepto({
  slug,
  shape,
  postits,
  conceptos: iniciales,
  editable,
}: {
  slug: string;
  shape: TemplateShape;
  postits: PostitLienzo[];
  conceptos: ConceptoLienzo[];
  editable: boolean;
}) {
  const router = useRouter();
  const [conceptos, setConceptos] = useState(iniciales);
  const [activoId, setActivoId] = useState<string | null>(iniciales[0]?.id ?? null);
  const [lente, setLente] = useState<string>("todas");
  const [selector, setSelector] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, start] = useTransition();

  useEffect(() => {
    setConceptos(iniciales);
    setActivoId((a) => (a && iniciales.some((c) => c.id === a) ? a : (iniciales[0]?.id ?? null)));
  }, [iniciales]);

  const activo = conceptos.find((c) => c.id === activoId) ?? null;
  const usados = useMemo(() => new Set(activo?.anclas.map((a) => a.fragmentId) ?? []), [activo]);
  const porId = useMemo(() => new Map(postits.map((p) => [p.id, p])), [postits]);
  const color = (rowId: string) => shape.rows.find((r) => r.id === rowId)?.color ?? "#6FBFB2";

  function correr<T extends { ok: boolean; error?: string }>(accion: () => Promise<T>, despues?: (r: T) => void) {
    setError(null);
    start(async () => {
      const r = await accion();
      if (!r.ok) {
        setError(r.error ?? "No se pudo guardar.");
        setConceptos(iniciales);
      } else despues?.(r);
      router.refresh();
    });
  }

  function anclar(fragmentId: string, rowId: string) {
    if (!activo) return;
    const p = porId.get(fragmentId);
    setConceptos((cs) =>
      cs.map((c) =>
        c.id === activo.id
          ? { ...c, anclas: [...c.anclas.filter((a) => a.fragmentId !== fragmentId), { fragmentId, rowId, texto: p?.text ?? "" }] }
          : c,
      ),
    );
    correr(() => anclarPostit(activo.id, fragmentId, rowId));
  }

  function soltar(fragmentId: string) {
    if (!activo) return;
    setConceptos((cs) => cs.map((c) => (c.id === activo.id ? { ...c, anclas: c.anclas.filter((a) => a.fragmentId !== fragmentId) } : c)));
    correr(() => soltarPostit(activo.id, fragmentId));
  }

  function nuevo() {
    correr(
      () => crearConcepto(slug),
      (r) => "id" in r && setActivoId(r.id as string),
    );
  }

  const chip = (p: PostitLienzo, arrastrable: boolean) => (
    <button
      key={p.id}
      type="button"
      draggable={arrastrable && editable && !!activo}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
      onClick={() => activo && editable && !usados.has(p.id) && anclar(p.id, p.rowId)}
      title={p.text}
      disabled={usados.has(p.id)}
      className={`relative rounded-[3px] px-2 py-1.5 text-left text-[11.5px] leading-snug text-[#1d2224] shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition ${
        usados.has(p.id) ? "opacity-35" : "hover:-translate-y-px"
      } ${arrastrable && editable && activo ? "cursor-grab active:cursor-grabbing" : ""}`}
      style={{ background: `color-mix(in srgb, ${color(p.rowId)} 28%, #f4ecd6)` }}
    >
      {usados.has(p.id) && <span className="mr-1">✓</span>}
      {tituloPostit(p)}
      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: VERIFICATION_META[p.verification].color }} />
    </button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,0.85fr)_1.4fr]">
      {/* El mapa, de donde se toman los post-its */}
      <aside className="hidden lg:block">
        <div className="sticky top-[72px] flex max-h-[calc(100vh-96px)] flex-col rounded-[4px] border border-[rgba(232,227,216,0.12)] bg-panel">
          <div className="flex flex-wrap gap-1.5 border-b border-[rgba(232,227,216,0.08)] p-3">
            {[{ id: "todas", name: "Todas" }, ...shape.cols].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setLente(c.id)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                  lente === c.id ? "border-accent text-accent" : "border-[rgba(232,227,216,0.14)] text-[#8b9a97]"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-4 overflow-y-auto p-3">
            {shape.rows.map((r) => {
              const lista = postits.filter((p) => p.rowId === r.id && (lente === "todas" || p.colId === lente));
              return (
                <section key={r.id}>
                  <h3 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-[#e8e3d8]">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                    {r.name}
                    <span className="font-normal text-[#5e7370]">{lista.length}</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-1.5">{lista.map((p) => chip(p, true))}</div>
                </section>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Los conceptos */}
      <div className="min-w-0">
        {error && (
          <p className="mb-3 rounded-[4px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] p-3 text-[12.5px] text-[#e8a99c]">{error}</p>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {conceptos.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActivoId(c.id)}
              className={`max-w-[220px] truncate rounded-full border px-3 py-1.5 text-[12.5px] ${
                c.id === activoId ? "border-accent bg-[rgba(111,191,178,0.14)] text-accent" : "border-[rgba(232,227,216,0.16)] text-[#a9b5b3]"
              }`}
            >
              {c.title}
              <span className="ml-1.5 text-[10.5px] opacity-70">{c.anclas.length}</span>
            </button>
          ))}
          {editable && (
            <button type="button" onClick={nuevo} disabled={pendiente} className="rounded-full border border-dashed border-[rgba(232,227,216,0.25)] px-3 py-1.5 text-[12.5px] text-[#a9b5b3] hover:border-accent hover:text-accent">
              + Nuevo concepto
            </button>
          )}
          {conceptos.some((c) => c.anclas.length > 0) && (
            <Link href={`/proyectos/${slug}/convergir`} className="btn btn-primary ml-auto">
              Priorizar →
            </Link>
          )}
        </div>

        {!activo ? (
          <div className="panel flex flex-col items-start gap-3 py-10">
            <p className="text-[16px] font-semibold text-[#e8e3d8]">Junten post-its del mapa para armar un concepto</p>
            <p className="hint">Uno o varios por dimensión: quién es el cliente, cómo le llega, qué le ofrecemos, cómo se produce y cómo ganamos dinero.</p>
            {editable && (
              <button type="button" onClick={nuevo} disabled={pendiente} className="btn btn-primary mt-2">
                Armar el primer concepto
              </button>
            )}
          </div>
        ) : (
          <Concepto
            key={activo.id}
            concepto={activo}
            shape={shape}
            porId={porId}
            editable={editable}
            pendiente={pendiente}
            sobre={sobre}
            setSobre={setSobre}
            onSoltar={soltar}
            onAnclar={anclar}
            onAbrirSelector={setSelector}
            onError={setError}
            onBorrar={() => {
              if (!confirm(`¿Borrar «${activo.title}»? Los post-its siguen en el mapa.`)) return;
              setConceptos((cs) => cs.filter((c) => c.id !== activo.id));
              correr(() => borrarConcepto(activo.id));
            }}
          />
        )}
      </div>

      {selector && activo && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:items-center" onClick={() => setSelector(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full overflow-y-auto rounded-t-[10px] border border-[rgba(232,227,216,0.14)] bg-[#151c1f] p-5 md:max-w-[620px] md:rounded-[8px]"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(selector) }} />
              <span className="text-[14px] font-semibold text-[#e8e3d8]">{PREGUNTA_LIENZO[selector] ?? shape.rows.find((r) => r.id === selector)?.name}</span>
              <span className="flex-1" />
              <button type="button" onClick={() => setSelector(null)} className="px-2 text-[18px] text-[#7f8f8c]" aria-label="Cerrar">
                ×
              </button>
            </div>
            {shape.cols.map((c) => {
              const lista = postits.filter((p) => p.rowId === selector && p.colId === c.id);
              if (!lista.length) return null;
              return (
                <section key={c.id} className="mb-3">
                  <h4 className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-[#7f8f8c]">{c.name}</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    {lista.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        disabled={usados.has(p.id)}
                        onClick={() => {
                          anclar(p.id, selector);
                          setSelector(null);
                        }}
                        className={`rounded-[3px] px-2 py-1.5 text-left text-[12px] leading-snug text-[#1d2224] ${usados.has(p.id) ? "opacity-35" : ""}`}
                        style={{ background: `color-mix(in srgb, ${color(p.rowId)} 28%, #f4ecd6)` }}
                      >
                        {usados.has(p.id) && "✓ "}
                        {tituloPostit(p)}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Concepto({
  concepto,
  shape,
  porId,
  editable,
  pendiente,
  sobre,
  setSobre,
  onSoltar,
  onAnclar,
  onAbrirSelector,
  onError,
  onBorrar,
}: {
  concepto: ConceptoLienzo;
  shape: TemplateShape;
  porId: Map<string, PostitLienzo>;
  editable: boolean;
  pendiente: boolean;
  sobre: string | null;
  setSobre: (k: string | null) => void;
  onSoltar: (fragmentId: string) => void;
  onAnclar: (fragmentId: string, rowId: string) => void;
  onAbrirSelector: (rowId: string) => void;
  onError: (e: string | null) => void;
  onBorrar: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(concepto.title);
  const [statement, setStatement] = useState(concepto.statement);
  const [redactando, startRedactar] = useTransition();
  const [guardando, startGuardar] = useTransition();
  const [guardado, setGuardado] = useState(false);
  const sucio = title !== concepto.title || statement !== concepto.statement;

  return (
    <div className="panel flex flex-col gap-4">
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setGuardado(false);
        }}
        disabled={!editable}
        maxLength={120}
        className="w-full bg-transparent text-[20px] font-bold text-[#e8e3d8] outline-none placeholder:text-[#5e7370]"
        placeholder="Nombre del concepto"
        aria-label="Nombre del concepto"
      />

      <ol className="flex flex-col">
        {shape.rows.map((r, i) => {
          const anclas = concepto.anclas.filter((a) => a.rowId === r.id);
          const k = `${concepto.id}|${r.id}`;
          return (
            <li key={r.id} className="flex flex-col">
              <div
                onDragOver={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  setSobre(k);
                }}
                onDragLeave={() => sobre === k && setSobre(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) onAnclar(id, r.id);
                }}
                className={`rounded-[4px] border p-3 transition ${
                  sobre === k ? "border-accent bg-[rgba(111,191,178,0.12)]" : "border-[rgba(232,227,216,0.1)] bg-[rgba(232,227,216,0.02)]"
                }`}
                style={{ borderLeft: `3px solid ${r.color}` }}
              >
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-[12.5px] font-semibold text-[#e8e3d8]">{r.name}</span>
                  <span className="text-[11.5px] text-[#7f8f8c]">{PREGUNTA_LIENZO[r.id] ?? r.facets}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {anclas.map((a, j) => {
                    const p = a.fragmentId ? porId.get(a.fragmentId) : undefined;
                    return (
                      <span
                        key={a.fragmentId ?? `copia-${j}`}
                        title={p?.text ?? a.texto}
                        className="flex max-w-full items-center gap-1.5 rounded-[3px] py-1 pl-2 pr-1 text-[12px] text-[#1d2224] shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                        style={{ background: `color-mix(in srgb, ${p ? shape.rows.find((x) => x.id === p.rowId)?.color : r.color} 28%, #f4ecd6)` }}
                      >
                        <span className="truncate">{p ? tituloPostit(p) : tituloPostit({ titulo: "", text: a.texto })}</span>
                        {editable && a.fragmentId && (
                          <button
                            type="button"
                            onClick={() => onSoltar(a.fragmentId!)}
                            className="rounded px-1 text-[13px] leading-none text-[#4b5456] hover:bg-black/10"
                            aria-label="Devolver al mapa"
                            title="Devolver al mapa"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {editable && (
                    <button
                      type="button"
                      onClick={() => onAbrirSelector(r.id)}
                      className="rounded-[3px] border border-dashed border-[rgba(232,227,216,0.2)] px-2.5 py-1 text-[12px] text-[#7f8f8c] hover:border-accent hover:text-accent"
                    >
                      {anclas.length ? "+" : "+ Agregar post-it"}
                    </button>
                  )}
                </div>
              </div>
              {i < shape.rows.length - 1 && <span className="ml-5 h-3 w-px bg-[rgba(232,227,216,0.18)]" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <label className="block">
        <span className="label">El concepto en una frase</span>
        <textarea
          value={statement}
          onChange={(e) => {
            setStatement(e.target.value);
            setGuardado(false);
          }}
          disabled={!editable}
          rows={4}
          placeholder="Ofreceremos … a …, que necesita …, entregado a través de …, producido por …, y generamos dinero mediante …"
          className="field resize-y leading-relaxed"
        />
      </label>

      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={guardando || pendiente || !sucio || !title.trim()}
            onClick={() =>
              startGuardar(async () => {
                onError(null);
                const r = await guardarConcepto(concepto.id, { title, statement });
                if (!r.ok) onError(r.error);
                else setGuardado(true);
                router.refresh();
              })
            }
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
          {guardado && !sucio && <span className="text-[12px] text-accent">Guardado</span>}
          <button
            type="button"
            className="btn"
            disabled={redactando || concepto.anclas.length === 0}
            title="La IA propone un nombre y la frase a partir de los post-its del concepto. Ustedes la corrigen antes de guardar."
            onClick={() =>
              startRedactar(async () => {
                onError(null);
                const r = await redactarConcepto(concepto.id);
                if (!r.ok) return onError(r.error);
                setStatement(r.frase);
                if (r.nombre && /^Concepto \d+$/.test(title)) setTitle(r.nombre);
                setGuardado(false);
              })
            }
          >
            {redactando ? "Redactando…" : "✦ Redactar con IA"}
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onBorrar} className="text-[12px] text-[#7f8f8c] hover:text-[#e8a99c]">
            Borrar concepto
          </button>
        </div>
      )}
    </div>
  );
}
