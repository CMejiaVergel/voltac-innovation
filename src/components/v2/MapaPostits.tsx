"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { TemplateShape } from "@/lib/templates";
import { VERIFICATIONS, VERIFICATION_META, type Verification } from "@/lib/enums";
import { tituloPostit } from "@/lib/v2";
import {
  createFragment,
  deleteFragment,
  moveFragment,
  setFragmentHidden,
  setVerification,
  updatePostit,
} from "@/app/actions/fragments";

export type Postit = {
  id: string;
  rowId: string;
  colId: string;
  titulo: string;
  text: string;
  verification: Verification;
  sourceUrl: string | null;
  sourceCitation: string | null;
  authorName: string | null;
};

type Panel = { modo: "ver"; id: string } | { modo: "nuevo"; rowId: string; colId: string } | null;

/**
 * El Mapa de Oportunidades como un pliego con post-its (mentor, 15-oct-2026):
 * todo el 5×5 en una pantalla, cada fragmento reducido a un título corto y el
 * texto completo a un toque. Se arrastran de una celda a otra como en papel.
 */
export function MapaPostits({
  mapId,
  shape,
  postits: iniciales,
  editable,
}: {
  mapId: string;
  shape: TemplateShape;
  postits: Postit[];
  editable: boolean;
}) {
  const router = useRouter();
  const [postits, setPostits] = useState(iniciales);
  const [panel, setPanel] = useState<Panel>(null);
  const [lente, setLente] = useState(0);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => setPostits(iniciales), [iniciales]);

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
    return (
      <button
        key={p.id}
        type="button"
        draggable={editable}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", p.id);
          setArrastrando(p.id);
        }}
        onDragEnd={() => {
          setArrastrando(null);
          setSobre(null);
        }}
        onClick={() => setPanel({ modo: "ver", id: p.id })}
        title={p.text}
        className={`relative w-full rounded-[3px] px-2 py-1.5 text-left text-[11.5px] leading-snug text-[#1d2224] shadow-[0_1px_2px_rgba(0,0,0,0.35)] transition hover:-translate-y-px hover:shadow-[0_3px_8px_rgba(0,0,0,0.4)] ${
          arrastrando === p.id ? "opacity-40" : ""
        } ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ background: `color-mix(in srgb, ${color} 28%, #f4ecd6)` }}
      >
        {tituloPostit(p)}
        <span
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
          style={{ background: VERIFICATION_META[p.verification].color }}
          aria-label={VERIFICATION_META[p.verification].label}
        />
      </button>
    );
  }

  function celda(rowId: string, colId: string, compacta?: boolean) {
    const k = `${rowId}|${colId}`;
    const notas = porCelda.get(k) ?? [];
    return (
      <div
        key={k}
        onDragOver={(e) => {
          if (!editable) return;
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
        {editable && (
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

      {/* Pantalla ancha: el pliego completo */}
      <div className="hidden overflow-x-auto md:block">
        <div
          className="grid min-w-[980px] gap-1.5"
          style={{ gridTemplateColumns: `128px repeat(${shape.cols.length}, minmax(0, 1fr))` }}
        >
          <span />
          {shape.cols.map((c) => (
            <div key={c.id} className="px-1 pb-1" title={c.question}>
              <span className="block text-[12.5px] font-semibold text-[#e8e3d8]">{c.name}</span>
              <span className="block text-[10.5px] leading-tight text-[#7f8f8c]">{c.question}</span>
            </div>
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
        <p className="mb-3 text-[12px] text-[#7f8f8c]">{shape.cols[lente]?.question}</p>
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
