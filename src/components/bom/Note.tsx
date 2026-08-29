"use client";

import { useDraggable } from "@dnd-kit/core";
import { useRef, useState } from "react";

import { VERIFICATION_META, VERIFICATIONS, type Verification } from "@/lib/enums";
import type { BoardFragment } from "./types";

/**
 * Un post-it.
 *
 * El arrastre se activa a partir de 8px de movimiento (ver el sensor del
 * tablero), asi que hacer clic para poner el cursor en el texto no dispara un
 * drag. Mientras se edita, el arrastre queda desactivado del todo.
 */
export function Note({
  fragment,
  editable,
  showVerification,
  onEditText,
  onSetVerification,
  onDelete,
  onReview,
}: {
  fragment: BoardFragment;
  editable: boolean;
  showVerification: boolean;
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

  const meta = VERIFICATION_META[fragment.verification];

  return (
    <div
      ref={setNodeRef}
      className={`note group ${isProposal ? "note-proposed" : ""} ${
        isDragging ? "opacity-30" : ""
      } ${editable && !editing ? "cursor-grab" : ""}`}
      {...(editable && !editing ? listeners : {})}
      {...attributes}
      title={
        fragment.agentRationale
          ? `Por que aqui: ${fragment.agentRationale}`
          : fragment.authorName ?? undefined
      }
    >
      <div
        ref={ref}
        className="note-text block"
        contentEditable={editable}
        suppressContentEditableWarning
        onFocus={() => setEditing(true)}
        onBlur={(e) => {
          setEditing(false);
          const next = e.currentTarget.textContent?.trim() ?? "";
          if (next && next !== fragment.text) onEditText(fragment.id, next);
          else if (!next) e.currentTarget.textContent = fragment.text;
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

        {fragment.sourceUrl && (
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

        {fragment.origin === "AGENT" && (
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
