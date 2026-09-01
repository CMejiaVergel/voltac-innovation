"use client";

import { useDraggable } from "@dnd-kit/core";
import { useEffect, useRef, useState } from "react";

import { VERIFICATION_META, VERIFICATIONS, type Verification } from "@/lib/enums";
import type { BoardFragment } from "./types";

/**
 * Un post-it.
 *
 * Editar exige DOBLE clic. Con un solo clic, un arrastre que empieza despacio
 * entraba en modo edicion sin querer: el umbral de 8px del sensor no alcanza
 * cuando el gesto arranca corto. El doble clic separa las dos intenciones sin
 * ambiguedad. Mientras se edita, el arrastre queda desactivado del todo.
 */
export function Note({
  fragment,
  editable,
  showVerification,
  showSource,
  showOrigin,
  onEditText,
  onSetVerification,
  onDelete,
  onReview,
}: {
  fragment: BoardFragment;
  editable: boolean;
  showVerification: boolean;
  showSource: boolean;
  showOrigin: boolean;
  onEditText: (id: string, text: string) => void;
  onSetVerification: (id: string, v: Verification) => void;
  onDelete: (id: string) => void;
  onReview?: (id: string, decision: "ACCEPT" | "REJECT") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isProposal = fragment.reviewState === "PROPOSED";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: fragment.id,
    disabled: !editable || editing,
  });

  // contentEditable solo existe mientras se edita, asi que hay que llevar el
  // cursor al texto una vez React lo ha vuelto editable.
  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  function guardar(el: HTMLElement) {
    const next = el.textContent?.trim() ?? "";
    if (next && next !== fragment.text) onEditText(fragment.id, next);
    else if (!next) el.textContent = fragment.text;
  }

  const meta = VERIFICATION_META[fragment.verification];

  return (
    <div
      ref={setNodeRef}
      className={`note group ${isProposal ? "note-proposed" : ""} ${
        isDragging ? "opacity-30" : ""
      } ${editable && !editing ? "cursor-grab" : ""}`}
      {...(editable && !editing ? listeners : {})}
      {...attributes}
      onDoubleClick={() => {
        if (editable) setEditing(true);
      }}
      title={
        fragment.agentRationale
          ? `Por que aqui: ${fragment.agentRationale}`
          : (fragment.authorName ?? undefined)
      }
    >
      <div
        ref={ref}
        className="note-text block"
        contentEditable={editable && editing}
        suppressContentEditableWarning
        onBlur={(e) => {
          guardar(e.currentTarget);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
          if (e.key === "Escape") {
            e.currentTarget.textContent = fragment.text;
            (e.currentTarget as HTMLElement).blur();
          }
        }}
      >
        {fragment.text}
      </div>

      {/* ── Pie del post-it ────────────────────────────────────────────────── */}
      <div className="mt-1 flex items-center gap-1.5">
        {showVerification && (
          <button
            type="button"
            disabled={!editable}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const i = VERIFICATIONS.indexOf(fragment.verification);
              onSetVerification(fragment.id, VERIFICATIONS[(i + 1) % VERIFICATIONS.length]);
            }}
            title={`${meta.label}. ${meta.help}${editable ? " Clic para cambiar." : ""}`}
            className="font-ui text-[9px] font-semibold uppercase leading-none tracking-[0.08em] disabled:cursor-default"
            style={{ color: meta.color }}
          >
            {meta.dot} {meta.short}
          </button>
        )}

        {showSource && fragment.sourceUrl && (
          <a
            href={fragment.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title={fragment.sourceCitation ?? fragment.sourceUrl}
            className="font-ui text-[9px] uppercase tracking-[0.08em] text-[#2F5D8C] underline"
          >
            fuente
          </a>
        )}

        {/* El origen se guarda siempre en la base y viaja en la exportacion y
            en el historial; aqui solo se decide si se muestra. */}
        {showOrigin && fragment.origin === "AGENT" && (
          <span
            title="Propuesto por el agente investigador"
            className="font-ui text-[9px] uppercase tracking-[0.08em] opacity-50"
          >
            IA
          </span>
        )}

        <span className="flex-1" />

        {editable && isProposal && onReview && (
          <span className="flex gap-1">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onReview(fragment.id, "ACCEPT")}
              className="rounded-[2px] bg-[#2F7D5F] px-1.5 py-0.5 font-ui text-[9px] font-semibold uppercase tracking-wider text-white"
            >
              aceptar
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onReview(fragment.id, "REJECT")}
              className="rounded-[2px] bg-[#8E3324] px-1.5 py-0.5 font-ui text-[9px] font-semibold uppercase tracking-wider text-white"
            >
              no
            </button>
          </span>
        )}

        {editable && !isProposal && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (menu) onDelete(fragment.id);
              else setMenu(true);
            }}
            onMouseLeave={() => setMenu(false)}
            className="font-ui text-[10px] leading-none text-noteInk/45 opacity-0 transition group-hover:opacity-100 hover:text-danger"
            title={menu ? "Confirmar: eliminar el fragmento" : "Eliminar"}
          >
            {menu ? "eliminar?" : "×"}
          </button>
        )}
      </div>
    </div>
  );
}
