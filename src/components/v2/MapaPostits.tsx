"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { TemplateShape } from "@/lib/templates";
import { VERIFICATIONS, VERIFICATION_META, type Verification } from "@/lib/enums";
import { colorDePersona, tituloPostit } from "@/lib/v2";
import {
  createFragment,
  deleteFragment,
  moveFragment,
  setFragmentHidden,
  setVerification,
  updatePostit,
} from "@/app/actions/fragments";
import { guardarInsightMapa, ocultarInsightMapa, type CamposInsightMapa } from "@/app/actions/insightsMapa";

export type Postit = {
  id: string;
  rowId: string;
  colId: string;
  titulo: string;
  text: string;
  verification: Verification;
  sourceUrl: string | null;
  sourceCitation: string | null;
  authorId: string | null;
  authorName: string | null;
};

/** Un insight dibujado sobre el mapa: lo que el equipo descubrió al conectar post-its. */
export type InsightMapa = CamposInsightMapa & {
  id: string;
  n: number;
  color: string;
  fragmentIds: string[];
  authorId: string | null;
  authorName: string | null;
};

type Panel = { modo: "ver"; id: string } | { modo: "nuevo"; rowId: string; colId: string } | null;

/** El insight que se está armando: primero se tocan los post-its, después se escribe. */
type Borrador = { id?: string; seleccion: string[]; campos: CamposInsightMapa; paso: "elegir" | "escribir" };

const CAMPOS_VACIOS: CamposInsightMapa = { statement: "", fact: "", pattern: "", implication: "", business: "", limitNote: "" };

/**
 * El Mapa de Oportunidades como un pliego con post-its (mentor, 15-oct-2026):
 * todo el 5×5 en una pantalla, cada fragmento reducido a un título corto y el
 * texto completo a un toque. Se arrastran de una celda a otra como en papel.
 *
 * Los insights se sacan aquí mismo, no en otra etapa: el propósito del mapa
 * es encontrarlos (IMBOK p. 37) y el mentor los quiere en el mapa. Cada uno
 * conecta los post-its que lo sostienen y se ve encima de ellos.
 */
export function MapaPostits({
  slug,
  mapId,
  shape,
  postits: iniciales,
  insights,
  editable,
}: {
  slug: string;
  mapId: string;
  shape: TemplateShape;
  postits: Postit[];
  insights: InsightMapa[];
  editable: boolean;
}) {
  const router = useRouter();
  const [postits, setPostits] = useState(iniciales);
  const [panel, setPanel] = useState<Panel>(null);
  const [lente, setLente] = useState(0);
  const [guia, setGuia] = useState<string | null>(null);
  const [foco, setFoco] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => setPostits(iniciales), [iniciales]);

  /** De qué insights forma parte cada post-it, para pintar sus marcas. */
  const insightsDe = useMemo(() => {
    const m = new Map<string, InsightMapa[]>();
    for (const i of insights) for (const id of i.fragmentIds) m.set(id, [...(m.get(id) ?? []), i]);
    return m;
  }, [insights]);
  const enfocado = insights.find((i) => i.id === foco) ?? null;
  const eligiendo = borrador?.paso === "elegir";

  function guardarInsight(b: Borrador) {
    setError(null);
    startTransition(async () => {
      const r = await guardarInsightMapa(slug, { id: b.id, fragmentIds: b.seleccion, campos: b.campos });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setBorrador(null);
      setFoco(r.id);
      router.refresh();
    });
  }

  function ocultarInsight(id: string) {
    if (!confirm("¿Quitar este insight del mapa? No se borra: queda guardado en el proyecto.")) return;
    startTransition(async () => {
      const r = await ocultarInsightMapa(slug, id);
      if (!r.ok) return setError(r.error);
      setBorrador(null);
      setFoco(null);
      router.refresh();
    });
  }

  const porCelda = useMemo(() => {
    const m = new Map<string, Postit[]>();
    for (const p of postits) {
      const k = `${p.rowId}|${p.colId}`;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [postits]);

  function correr(accion: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await accion();
        router.refresh();
      } catch {
        setError("No se pudo guardar. Revisa la conexión e inténtalo de nuevo.");
        setPostits(iniciales);
      }
    });
  }

  function mover(id: string, rowId: string, colId: string) {
    const p = postits.find((x) => x.id === id);
    if (!p || (p.rowId === rowId && p.colId === colId)) return;
    setPostits((xs) => xs.map((x) => (x.id === id ? { ...x, rowId, colId } : x)));
    correr(() => moveFragment(id, rowId, colId));
  }

  const fila = (rowId: string) => shape.rows.find((r) => r.id === rowId);

  function nota(p: Postit) {
    const color = fila(p.rowId)?.color ?? "#6FBFB2";
    const suyos = insightsDe.get(p.id) ?? [];
    const elegido = eligiendo && borrador!.seleccion.includes(p.id);
    const apagado = eligiendo ? !elegido : enfocado ? !enfocado.fragmentIds.includes(p.id) : false;
    const anillo = elegido ? "#e8e3d8" : enfocado && !apagado ? enfocado.color : null;
    return (
      <button
        key={p.id}
        type="button"
        draggable={editable && !eligiendo}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", p.id);
          setArrastrando(p.id);
        }}
        onDragEnd={() => {
          setArrastrando(null);
          setSobre(null);
        }}
        onClick={() => {
          if (!eligiendo) return setPanel({ modo: "ver", id: p.id });
          const b = borrador!;
          setBorrador({ ...b, seleccion: elegido ? b.seleccion.filter((x) => x !== p.id) : [...b.seleccion, p.id] });
        }}
        title={p.authorName ? `${p.text}\n\n— ${p.authorName}` : p.text}
        className={`relative w-full rounded-[3px] py-1.5 pl-2.5 pr-2 text-left text-[11.5px] leading-snug text-[#1d2224] shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(0,0,0,0.4)] ${
          arrastrando === p.id || apagado ? "opacity-35" : ""
        } ${editable && !eligiendo ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{
          background: `color-mix(in srgb, ${color} 28%, #f4ecd6)`,
          // El color de quien lo puso, como en la edición colaborativa de Office.
          boxShadow: `inset 3px 0 0 ${p.authorId ? colorDePersona(p.authorId) : "transparent"}${anillo ? `, 0 0 0 2px ${anillo}` : ""}`,
        }}
      >
        {tituloPostit(p)}
        <span
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
          style={{ background: VERIFICATION_META[p.verification].color }}
          aria-label={VERIFICATION_META[p.verification].label}
        />
        {suyos.length > 0 && (
          <span className="mt-1 flex gap-0.5" aria-label={`En ${suyos.length} insight${suyos.length > 1 ? "s" : ""}`}>
            {suyos.map((i) => (
              <span key={i.id} className="grid h-3.5 min-w-3.5 place-items-center rounded-full px-0.5 text-[8.5px] font-bold text-[#12181b]" style={{ background: i.color }}>
                {i.n}
              </span>
            ))}
          </span>
        )}
      </button>
    );
  }

  function barraInsights() {
    if (borrador?.paso === "elegir") {
      return (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-[6px] border border-accent bg-[#12262a] p-3 text-[12.5px] text-[#e8e3d8] shadow-lg">
          <span>
            Toque los post-its que se conectan. <b>{borrador.seleccion.length}</b> elegidos.
          </span>
          <span className="flex-1" />
          <button type="button" className="btn" onClick={() => setBorrador(borrador.id ? { ...borrador, paso: "escribir" } : null)}>
            {borrador.id ? "Volver" : "Cancelar"}
          </button>
          <button type="button" className="btn btn-primary" disabled={borrador.seleccion.length < 2} onClick={() => setBorrador({ ...borrador, paso: "escribir" })}>
            Escribir el insight →
          </button>
        </div>
      );
    }
    if (!insights.length && !editable) return null;
    return (
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12px] font-semibold text-[#e8e3d8]">Insights</span>
          {insights.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setFoco(foco === i.id ? null : i.id)}
              className="flex max-w-[260px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]"
              style={
                foco === i.id
                  ? { borderColor: i.color, background: `${i.color}2e`, color: "#e8e3d8" }
                  : { borderColor: "rgba(232,227,216,0.16)", color: "#a9b5b3" }
              }
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: i.color }} />
              <span className="truncate">
                {i.n} · {i.statement}
              </span>
            </button>
          ))}
          {editable && (
            <button
              type="button"
              onClick={() => {
                setFoco(null);
                setBorrador({ seleccion: [], campos: CAMPOS_VACIOS, paso: "elegir" });
              }}
              className="rounded-full border border-dashed border-[rgba(111,191,178,0.5)] px-3 py-1 text-[12px] text-accent hover:bg-[rgba(111,191,178,0.1)]"
            >
              + Conectar post-its
            </button>
          )}
        </div>
        {enfocado && (
          <div className="mt-2 rounded-[6px] border p-3 text-[12.5px] leading-relaxed text-[#c9d1cf]" style={{ borderColor: `${enfocado.color}88` }}>
            <p className="text-[14px] font-semibold text-[#e8e3d8]">{enfocado.statement}</p>
            {enfocado.implication && (
              <p className="mt-1">
                <span className="text-[#8b9a97]">¿Y qué? </span>
                {enfocado.implication}
              </p>
            )}
            {enfocado.business && (
              <p className="mt-1">
                <span className="text-[#8b9a97]">Oportunidad: </span>
                {enfocado.business}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-[#7f8f8c]">
              <span>
                {enfocado.fragmentIds.length} post-its{enfocado.authorName ? ` · lo propuso ${enfocado.authorName}` : ""}
              </span>
              <span className="flex-1" />
              {editable && (
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setBorrador({
                      id: enfocado.id,
                      seleccion: enfocado.fragmentIds,
                      campos: {
                        statement: enfocado.statement,
                        fact: enfocado.fact,
                        pattern: enfocado.pattern,
                        implication: enfocado.implication,
                        business: enfocado.business,
                        limitNote: enfocado.limitNote,
                      },
                      paso: "escribir",
                    })
                  }
                >
                  Abrir
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /** El ejercicio de una lente, como lo plantea el GIMI. */
  function guiaLente(colId: string) {
    const c = shape.cols.find((x) => x.id === colId);
    if (!c?.ejercicio?.length) return null;
    return (
      <div className="mb-3 rounded-[6px] border border-[rgba(232,227,216,0.12)] bg-[rgba(232,227,216,0.03)] p-3 text-[12.5px] leading-relaxed text-[#c9d1cf]">
        <div className="mb-1 flex items-center gap-2">
          <b className="text-[#e8e3d8]">
            {c.name}: {c.question}
          </b>
          <span className="flex-1" />
          <button type="button" onClick={() => setGuia(null)} className="px-1 text-[16px] leading-none text-[#7f8f8c] hover:text-white max-md:hidden" aria-label="Cerrar guía">
            ×
          </button>
        </div>
        <ol className="list-decimal space-y-0.5 pl-5">
          {c.ejercicio.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
        {c.fuente && <p className="mt-1.5 text-[10.5px] text-[#5e7370]">{c.fuente}</p>}
      </div>
    );
  }

  function celda(rowId: string, colId: string, compacta?: boolean) {
    const k = `${rowId}|${colId}`;
    const notas = porCelda.get(k) ?? [];
    return (
      <div
        key={k}
        onDragOver={(e) => {
          if (!editable || eligiendo) return;
          e.preventDefault();
          setSobre(k);
        }}
        onDragLeave={() => setSobre((s) => (s === k ? null : s))}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/plain");
          setSobre(null);
          setArrastrando(null);
          if (id) mover(id, rowId, colId);
        }}
        className={`group flex min-h-[64px] flex-col gap-1.5 rounded-[4px] p-1.5 transition ${
          sobre === k
            ? "bg-[rgba(111,191,178,0.16)] outline outline-1 outline-accent"
            : notas.length
              ? "bg-[rgba(232,227,216,0.03)]"
              : "border border-dashed border-[rgba(232,227,216,0.12)]"
        } ${compacta ? "max-h-[260px] overflow-y-auto" : ""}`}
      >
        {notas.map((p) => nota(p))}
        {editable && !eligiendo && (
          <button
            type="button"
            onClick={() => setPanel({ modo: "nuevo", rowId, colId })}
            className={`rounded-[3px] py-1 text-[12px] text-[#5e7370] transition hover:bg-[rgba(232,227,216,0.06)] hover:text-accent ${
              notas.length ? "opacity-0 group-hover:opacity-100 max-md:opacity-100" : ""
            }`}
            aria-label="Agregar post-it"
          >
            +
          </button>
        )}
      </div>
    );
  }

  const abierto = panel?.modo === "ver" ? postits.find((p) => p.id === panel.id) : null;

  return (
    <>
      {error && (
        <p className="mb-3 rounded-[4px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] p-3 text-[12.5px] text-[#e8a99c]">
          {error}
        </p>
      )}

      {barraInsights()}

      {/* Pantalla ancha: el pliego completo */}
      <div className="hidden md:block">{guia && guiaLente(guia)}</div>
      <div className="hidden overflow-x-auto md:block">
        <div
          className="grid min-w-[980px] gap-1.5"
          style={{ gridTemplateColumns: `128px repeat(${shape.cols.length}, minmax(0, 1fr))` }}
        >
          <span />
          {shape.cols.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setGuia(guia === c.id ? null : c.id)}
              className={`rounded-[4px] px-1 pb-1 text-left transition hover:bg-[rgba(232,227,216,0.05)] ${guia === c.id ? "bg-[rgba(111,191,178,0.1)]" : ""}`}
              title="Ver el ejercicio de esta lente"
            >
              <span className="block text-[12.5px] font-semibold text-[#e8e3d8]">{c.name}</span>
              <span className="block text-[10.5px] leading-tight text-[#7f8f8c]">{c.question}</span>
            </button>
          ))}
          {shape.rows.map((r) => filaAncha(r))}
        </div>
      </div>

      {/* Celular: una lente a la vez, las cinco dimensiones hacia abajo */}
      <div className="md:hidden">
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {shape.cols.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setLente(i)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] ${
                i === lente ? "border-accent bg-[rgba(111,191,178,0.14)] text-accent" : "border-[rgba(232,227,216,0.16)] text-[#a9b5b3]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <details className="mb-3">
          <summary className="cursor-pointer text-[12px] text-[#7f8f8c]">{shape.cols[lente]?.question}</summary>
          <div className="mt-2">{shape.cols[lente] && guiaLente(shape.cols[lente].id)}</div>
        </details>
        <div className="flex flex-col gap-3">
          {shape.rows.map((r) => (
            <section key={r.id}>
              <h3 className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold text-[#e8e3d8]">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                {r.name}
              </h3>
              {celda(r.id, shape.cols[lente].id)}
            </section>
          ))}
        </div>
      </div>

      {borrador?.paso === "escribir" && (
        <PanelInsight
          borrador={borrador}
          postits={postits}
          shape={shape}
          pendiente={pendiente}
          error={error}
          onCambiar={setBorrador}
          onCerrar={() => setBorrador(null)}
          onGuardar={() => guardarInsight(borrador)}
          onOcultar={borrador.id ? () => ocultarInsight(borrador.id!) : undefined}
        />
      )}

      {panel && (
        <PanelPostit
          key={panel.modo === "ver" ? panel.id : `${panel.rowId}|${panel.colId}`}
          shape={shape}
          postit={abierto ?? null}
          celda={panel.modo === "nuevo" ? { rowId: panel.rowId, colId: panel.colId } : null}
          editable={editable}
          pendiente={pendiente}
          onCerrar={() => setPanel(null)}
          onGuardar={(datos) => {
            if (abierto) {
              setPostits((xs) => xs.map((x) => (x.id === abierto.id ? { ...x, ...datos } : x)));
              correr(async () => {
                await updatePostit(abierto.id, { titulo: datos.titulo, text: datos.text });
                if (datos.verification !== abierto.verification) await setVerification(abierto.id, datos.verification);
                if (datos.rowId !== abierto.rowId || datos.colId !== abierto.colId) await moveFragment(abierto.id, datos.rowId, datos.colId);
              });
            } else {
              correr(async () => {
                const { id } = await createFragment({ mapId, rowId: datos.rowId, colId: datos.colId, text: datos.text, titulo: datos.titulo });
                if (datos.verification !== "TO_CONFIRM") await setVerification(id, datos.verification);
              });
            }
            setPanel(null);
          }}
          onOcultar={() => {
            if (!abierto) return;
            setPostits((xs) => xs.filter((x) => x.id !== abierto.id));
            correr(() => setFragmentHidden(abierto.id, true));
            setPanel(null);
          }}
          onBorrar={() => {
            if (!abierto || !confirm("¿Borrar este post-it? Queda registrado en el historial.")) return;
            setPostits((xs) => xs.filter((x) => x.id !== abierto.id));
            correr(() => deleteFragment(abierto.id));
            setPanel(null);
          }}
        />
      )}
    </>
  );

  function filaAncha(r: TemplateShape["rows"][number]) {
    return (
      <Fragment key={r.id}>
        <div className="flex flex-col justify-center rounded-[4px] px-2.5 py-2" style={{ background: `${r.color}26`, borderLeft: `3px solid ${r.color}` }}>
          <span className="text-[13px] font-semibold text-[#e8e3d8]">{r.name}</span>
          <span className="text-[10px] leading-tight text-[#8b9a97]">{r.facets}</span>
        </div>
        {shape.cols.map((c) => celda(r.id, c.id, true))}
      </Fragment>
    );
  }
}

type Datos = { titulo: string; text: string; verification: Verification; rowId: string; colId: string };

function PanelPostit({
  shape,
  postit,
  celda,
  editable,
  pendiente,
  onCerrar,
  onGuardar,
  onOcultar,
  onBorrar,
}: {
  shape: TemplateShape;
  postit: Postit | null;
  celda: { rowId: string; colId: string } | null;
  editable: boolean;
  pendiente: boolean;
  onCerrar: () => void;
  onGuardar: (d: Datos) => void;
  onOcultar: () => void;
  onBorrar: () => void;
}) {
  const [d, setD] = useState<Datos>({
    titulo: postit?.titulo ?? "",
    text: postit?.text ?? "",
    verification: postit?.verification ?? "TO_CONFIRM",
    rowId: postit?.rowId ?? celda!.rowId,
    colId: postit?.colId ?? celda!.colId,
  });
  const fila = shape.rows.find((r) => r.id === d.rowId);
  const col = shape.cols.find((c) => c.id === d.colId);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:items-center" onClick={onCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (d.text.trim()) onGuardar(d);
        }}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[10px] border border-[rgba(232,227,216,0.14)] bg-[#151c1f] p-5 md:max-w-[560px] md:rounded-[8px]"
      >
        <div className="mb-4 flex items-center gap-2 text-[12px] text-[#8b9a97]">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: fila?.color }} />
          {fila?.name} · {col?.name}
          <span className="flex-1" />
          <button type="button" onClick={onCerrar} className="px-2 text-[18px] leading-none text-[#7f8f8c] hover:text-white" aria-label="Cerrar">
            ×
          </button>
        </div>

        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <label className="block">
            <span className="label">Título del post-it</span>
            <input
              value={d.titulo}
              onChange={(e) => setD({ ...d, titulo: e.target.value })}
              maxLength={80}
              placeholder={d.text ? tituloPostit({ titulo: "", text: d.text }) : "Ej. Certificación ISCC PLUS"}
              className="field text-[15px] font-semibold"
              autoFocus={!postit}
            />
          </label>
          <label className="block">
            <span className="label">Detalle</span>
            <textarea
              value={d.text}
              onChange={(e) => setD({ ...d, text: e.target.value })}
              rows={5}
              required
              placeholder={col?.hint}
              className="field resize-y leading-relaxed"
            />
          </label>

          <div>
            <span className="label">¿Qué tan seguro es?</span>
            <div className="flex flex-wrap gap-1.5">
              {VERIFICATIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setD({ ...d, verification: v })}
                  title={VERIFICATION_META[v].help}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px]"
                  style={
                    d.verification === v
                      ? { borderColor: VERIFICATION_META[v].color, background: `${VERIFICATION_META[v].color}33`, color: "#e8e3d8" }
                      : { borderColor: "rgba(232,227,216,0.16)", color: "#a9b5b3" }
                  }
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: VERIFICATION_META[v].color }} />
                  {VERIFICATION_META[v].label}
                </button>
              ))}
            </div>
          </div>

          {postit && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Dimensión</span>
                <select value={d.rowId} onChange={(e) => setD({ ...d, rowId: e.target.value })} className="field">
                  {shape.rows.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Lente</span>
                <select value={d.colId} onChange={(e) => setD({ ...d, colId: e.target.value })} className="field">
                  {shape.cols.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </fieldset>

        {postit && (postit.sourceUrl || postit.sourceCitation) && (
          <p className="mt-4 text-[12px] text-[#8b9a97]">
            Fuente:{" "}
            {postit.sourceUrl ? (
              <a href={postit.sourceUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                {postit.sourceCitation || postit.sourceUrl}
              </a>
            ) : (
              postit.sourceCitation
            )}
          </p>
        )}
        {postit?.authorName && <p className="mt-1 text-[11px] text-[#5e7370]">Lo puso {postit.authorName}</p>}

        {editable && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button type="submit" className="btn btn-primary" disabled={pendiente || !d.text.trim()}>
              {postit ? "Guardar" : "Pegar en el mapa"}
            </button>
            <span className="flex-1" />
            {postit && (
              <>
                <button type="button" onClick={onOcultar} className="btn">
                  Ocultar
                </button>
                <button type="button" onClick={onBorrar} className="btn btn-danger">
                  Borrar
                </button>
              </>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

/**
 * Escribir un insight a partir de los post-its conectados. Sigue la escalera
 * del GIMI: datos → información → «¿y qué?» → insight (Masterclass 2, lám.
 * 100), y cierra con su chequeo de cuatro preguntas (lám. 104).
 */
const ESCALERA: { campo: keyof CamposInsightMapa; nombre: string; ayuda: string; filas: number }[] = [
  { campo: "fact", nombre: "Los datos", ayuda: "Lo que dicen los post-its conectados: hechos, cifras, señales.", filas: 2 },
  { campo: "pattern", nombre: "Lo que tienen en común", ayuda: "El patrón que aparece al juntarlos.", filas: 2 },
  { campo: "implication", nombre: "¿Y qué?", ayuda: "Pregúntelo una y otra vez hasta llegar al fondo.", filas: 2 },
  { campo: "statement", nombre: "El insight", ayuda: "La comprensión profunda, en una frase que se entienda sola.", filas: 2 },
  { campo: "business", nombre: "La oportunidad que abre", ayuda: "Lo que la empresa podría hacer y antes no veía.", filas: 2 },
];

const CHEQUEO = [
  "¿Realmente buscó en todas partes?",
  "¿Preguntó «¿y qué?» al menos 5 veces?",
  "¿Lo compartió y la gente dijo «lo entendí»?",
  "¿Es capaz de actuar con él?",
];

function PanelInsight({
  borrador,
  postits,
  shape,
  pendiente,
  error,
  onCambiar,
  onCerrar,
  onGuardar,
  onOcultar,
}: {
  borrador: Borrador;
  postits: Postit[];
  shape: TemplateShape;
  pendiente: boolean;
  error: string | null;
  onCambiar: (b: Borrador) => void;
  onCerrar: () => void;
  onGuardar: () => void;
  onOcultar?: () => void;
}) {
  const [revisado, setRevisado] = useState<number[]>([]);
  const elegidos = borrador.seleccion.map((id) => postits.find((p) => p.id === id)).filter((p): p is Postit => !!p);
  const c = borrador.campos;

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 md:items-center" onClick={onCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (c.statement.trim()) onGuardar();
        }}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[10px] border border-[rgba(232,227,216,0.14)] bg-[#151c1f] p-5 md:max-w-[620px] md:rounded-[8px]"
      >
        <div className="mb-3 flex items-center gap-2">
          <b className="text-[15px] text-[#e8e3d8]">{borrador.id ? "Insight" : "Nuevo insight"}</b>
          <span className="flex-1" />
          <button type="button" onClick={onCerrar} className="px-2 text-[18px] leading-none text-[#7f8f8c] hover:text-white" aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {elegidos.map((p) => {
            const f = shape.rows.find((r) => r.id === p.rowId);
            return (
              <span
                key={p.id}
                title={p.text}
                className="flex items-center gap-1 rounded-[3px] py-0.5 pl-2 pr-1 text-[11.5px] text-[#1d2224]"
                style={{ background: `color-mix(in srgb, ${f?.color ?? "#6FBFB2"} 28%, #f4ecd6)` }}
              >
                {tituloPostit(p)}
                <button
                  type="button"
                  onClick={() => onCambiar({ ...borrador, seleccion: borrador.seleccion.filter((x) => x !== p.id) })}
                  className="px-1 text-[13px] leading-none text-[#5b5348] hover:text-black"
                  aria-label="Soltar este post-it"
                >
                  ×
                </button>
              </span>
            );
          })}
          <button type="button" onClick={() => onCambiar({ ...borrador, paso: "elegir" })} className="rounded-[3px] border border-dashed border-[rgba(111,191,178,0.5)] px-2 py-0.5 text-[11.5px] text-accent">
            + post-its
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {ESCALERA.map((e) => (
            <label key={e.campo} className="block">
              <span className="label">
                {e.nombre}
                {e.campo === "statement" && " *"}
              </span>
              <textarea
                value={c[e.campo]}
                onChange={(ev) => onCambiar({ ...borrador, campos: { ...c, [e.campo]: ev.target.value } })}
                rows={e.filas}
                placeholder={e.ayuda}
                required={e.campo === "statement"}
                className={`field resize-y leading-relaxed ${e.campo === "statement" ? "text-[14.5px] font-semibold" : ""}`}
              />
            </label>
          ))}
          <details open={!!c.limitNote}>
            <summary className="cursor-pointer text-[12px] text-[#8b9a97]">Hasta dónde llega la evidencia</summary>
            <textarea
              value={c.limitNote}
              onChange={(ev) => onCambiar({ ...borrador, campos: { ...c, limitNote: ev.target.value } })}
              rows={2}
              placeholder="Lo que todavía no se puede afirmar con estos post-its."
              className="field mt-2 resize-y leading-relaxed"
            />
          </details>
        </div>

        <div className="mt-4 rounded-[6px] bg-[rgba(232,227,216,0.04)] p-3">
          <p className="mb-1.5 text-[12px] font-semibold text-[#e8e3d8]">Cuando crea tener un insight</p>
          {CHEQUEO.map((q, i) => (
            <label key={q} className="flex items-center gap-2 py-0.5 text-[12.5px] text-[#c9d1cf]">
              <input
                type="checkbox"
                checked={revisado.includes(i)}
                onChange={() => setRevisado(revisado.includes(i) ? revisado.filter((x) => x !== i) : [...revisado, i])}
              />
              {q}
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-[12.5px] text-[#e8a99c]">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={pendiente || !c.statement.trim() || borrador.seleccion.length < 2}>
            {borrador.id ? "Guardar" : "Poner en el mapa"}
          </button>
          <span className="flex-1" />
          {onOcultar && (
            <button type="button" onClick={onOcultar} className="btn">
              Quitar del mapa
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
