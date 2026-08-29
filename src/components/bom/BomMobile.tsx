"use client";

import { useState } from "react";

import type { TemplateShape } from "@/lib/templates";
import { THIN_CELL_THRESHOLD } from "@/lib/gimi";
import { VERIFICATION_META, VERIFICATIONS, type Verification } from "@/lib/enums";
import type { BoardFragment } from "./types";

/**
 * El mapa en un telefono.
 *
 * Una matriz de 5x5 con post-its no cabe en una pantalla de movil: obligaria a
 * hacer zoom y desplazamiento en dos ejes a la vez. Aqui se navega por LENTE:
 * se elige uno arriba y debajo quedan las cinco dimensiones en tarjetas
 * apiladas, que es exactamente como se recorre el ejercicio en el taller —
 * "ahora miremos todo desde Adyacencias".
 *
 * No hay arrastrar y soltar, que en tactil pelea con el desplazamiento. Mover
 * un fragmento se hace con un desplegable nativo, que en movil abre la rueda
 * del sistema y es mas rapido y preciso que arrastrar.
 */
export function BomMobile({
  shape,
  byCell,
  editable,
  showGaps,
  onAdd,
  onEditText,
  onSetVerification,
  onDelete,
  onReview,
  onMove,
}: {
  shape: TemplateShape;
  byCell: Map<string, BoardFragment[]>;
  editable: boolean;
  showGaps: boolean;
  onAdd: (rowId: string, colId: string) => void;
  onEditText: (id: string, text: string) => void;
  onSetVerification: (id: string, v: Verification) => void;
  onDelete: (id: string) => void;
  onReview: (id: string, decision: "ACCEPT" | "REJECT") => void;
  onMove: (id: string, rowId: string, colId: string) => void;
}) {
  const [lens, setLens] = useState(shape.cols[0]?.id ?? "");
  const col = shape.cols.find((c) => c.id === lens) ?? shape.cols[0];

  return (
    <div className="md:hidden">
      {/* Selector de lente: se desplaza en horizontal, una sola fila */}
      <div className="no-print sticky top-[100px] z-30 -mx-4 border-b border-[rgba(232,227,216,0.12)] bg-[rgba(18,24,27,0.97)] px-4 py-2 backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shape.cols.map((c) => {
            const n = shape.rows.reduce(
              (a, r) => a + (byCell.get(`${r.id}|${c.id}`)?.length ?? 0),
              0,
            );
            const active = c.id === lens;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setLens(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] transition ${
                  active
                    ? "bg-accent font-semibold text-accentDeep"
                    : "border border-[rgba(192,204,202,0.25)] text-[#a9b5b3]"
                }`}
              >
                {c.name}
                <span className={`ml-1.5 font-mono text-[10px] ${active ? "opacity-70" : "opacity-50"}`}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {col && (
        <p className="mt-3 text-[12px] leading-relaxed text-[#8b9a97]">
          <b className="text-[#cbd4d2]">{col.question}.</b> {col.hint}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-4 pb-4">
        {shape.rows.map((row) => {
          const items = byCell.get(`${row.id}|${lens}`) ?? [];
          const accepted = items.filter((f) => f.reviewState === "ACCEPTED").length;
          const thin = showGaps && accepted < THIN_CELL_THRESHOLD;

          return (
            <section
              key={row.id}
              className="overflow-hidden rounded-[6px] border border-[rgba(232,227,216,0.12)] bg-board"
            >
              <header
                className="flex items-baseline gap-2 px-3 py-2.5 text-white"
                style={{ background: row.color }}
              >
                <h3 className="text-[15px] font-bold leading-none tracking-[-0.02em]">
                  {row.name}
                </h3>
                <span className="text-[10px] leading-tight text-white/75">{row.facets}</span>
                <span className="flex-1" />
                <span className="font-mono text-[10px] text-white/70">{accepted}</span>
              </header>

              <div className={`flex flex-col gap-2 p-2.5 ${thin ? "is-thin" : ""}`}>
                {items.length === 0 && (
                  <p className="px-1 py-3 text-center text-[12px] text-[#9c958a]">
                    Sin fragmentos en esta celda.
                  </p>
                )}

                {items.map((f) => (
                  <MobileNote
                    key={f.id}
                    fragment={f}
                    shape={shape}
                    editable={editable}
                    onEditText={onEditText}
                    onSetVerification={onSetVerification}
                    onDelete={onDelete}
                    onReview={onReview}
                    onMove={onMove}
                  />
                ))}

                {editable && (
                  <button
                    type="button"
                    onClick={() => onAdd(row.id, lens)}
                    className="rounded-[3px] border border-dashed border-boardLine px-3 py-2.5 text-[12.5px] text-[#77706a] active:bg-black/5"
                  >
                    + fragmento
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function MobileNote({
  fragment,
  shape,
  editable,
  onEditText,
  onSetVerification,
  onDelete,
  onReview,
  onMove,
}: {
  fragment: BoardFragment;
  shape: TemplateShape;
  editable: boolean;
  onEditText: (id: string, text: string) => void;
  onSetVerification: (id: string, v: Verification) => void;
  onDelete: (id: string) => void;
  onReview: (id: string, decision: "ACCEPT" | "REJECT") => void;
  onMove: (id: string, rowId: string, colId: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const isProposal = fragment.reviewState === "PROPOSED";
  const meta = VERIFICATION_META[fragment.verification];

  return (
    <article className={`note ${isProposal ? "note-proposed" : ""} !rotate-0 px-3 py-2.5`}>
      <div
        className="note-text block text-[17px] leading-snug"
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={(e) => {
          const next = e.currentTarget.textContent?.trim() ?? "";
          if (next && next !== fragment.text) onEditText(fragment.id, next);
          else if (!next) e.currentTarget.textContent = fragment.text;
        }}
      >
        {fragment.text}
      </div>

      {isProposal && fragment.agentRationale && (
        <p className="mt-1.5 font-ui text-[11px] leading-snug opacity-70">
          {fragment.agentRationale}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            const i = VERIFICATIONS.indexOf(fragment.verification);
            onSetVerification(fragment.id, VERIFICATIONS[(i + 1) % VERIFICATIONS.length]);
          }}
          className="font-ui text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: meta.color }}
        >
          {meta.dot} {meta.label}
        </button>

        {fragment.sourceUrl && (
          <a
            href={fragment.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="font-ui text-[10px] uppercase tracking-[0.08em] text-[#2F5D8C] underline"
          >
            fuente
          </a>
        )}

        {fragment.origin === "AGENT" && (
          <span className="font-ui text-[10px] uppercase tracking-[0.08em] opacity-45">IA</span>
        )}

        <span className="flex-1" />

        {editable && isProposal ? (
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onReview(fragment.id, "ACCEPT")}
              className="rounded-[3px] bg-[#2F7D5F] px-2.5 py-1 font-ui text-[11px] font-semibold uppercase tracking-wider text-white"
            >
              aceptar
            </button>
            <button
              type="button"
              onClick={() => onReview(fragment.id, "REJECT")}
              className="rounded-[3px] bg-[#8E3324] px-2.5 py-1 font-ui text-[11px] font-semibold uppercase tracking-wider text-white"
            >
              descartar
            </button>
          </span>
        ) : (
          editable && (
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label="Acciones del fragmento"
              className="px-2 font-ui text-[15px] leading-none text-noteInk/50"
            >
              ⋯
            </button>
          )
        )}
      </div>

      {menu && editable && (
        <div className="mt-2.5 flex flex-col gap-2 border-t border-black/10 pt-2.5">
          {/* Desplegable nativo: en movil abre la rueda del sistema, que es mas
              precisa que arrastrar y no pelea con el desplazamiento. */}
          <label className="font-ui text-[10px] uppercase tracking-[0.12em] text-noteInk/60">
            Mover a
            <select
              value={`${fragment.rowId}|${fragment.colId}`}
              onChange={(e) => {
                const [r, c] = e.target.value.split("|");
                onMove(fragment.id, r, c);
                setMenu(false);
              }}
              className="mt-1 w-full rounded-[3px] border border-black/15 bg-white/70 px-2 py-2 font-ui text-[13px] normal-case tracking-normal text-noteInk"
            >
              {shape.rows.map((r) => (
                <optgroup key={r.id} label={r.name}>
                  {shape.cols.map((c) => (
                    <option key={c.id} value={`${r.id}|${c.id}`}>
                      {r.name} · {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              onDelete(fragment.id);
              setMenu(false);
            }}
            className="rounded-[3px] bg-[#8E3324] px-3 py-2 font-ui text-[12px] font-semibold text-white"
          >
            Eliminar fragmento
          </button>
        </div>
      )}
    </article>
  );
}
