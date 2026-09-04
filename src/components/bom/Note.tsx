"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";

import { VERIFICATION_META, VERIFICATIONS, type Verification } from "@/lib/enums";
import { colorDeItem } from "@/lib/templates";
import type { BoardFragment } from "./types";

/**
 * Un post-it.
 *
 * Es ORDENABLE, no solo arrastrable: al soltarlo, el equipo decide a la vez en
 * que celda cae y en que posicion dentro de ella. Dentro de una celda el orden
 * es una decision de lectura.
 *
 * Editar exige DOBLE clic. Con un solo clic, un arrastre que empieza despacio
 * entraba en modo edicion sin querer. Mientras se edita, el arrastre queda
 * desactivado del todo.
 */
export function Note({
  fragment,
  items,
  editable,
  showVerification,
  showSource,
  showOrigin,
  onEditText,
  onSetItems,
  onSetVerification,
  onSetHidden,
  onDelete,
  onReview,
}: {
  fragment: BoardFragment;
  /** Facetas de la fila a la que pertenece este post-it. */
  items: string[];
  editable: boolean;
  showVerification: boolean;
  showSource: boolean;
  showOrigin: boolean;
  onEditText: (id: string, text: string) => void;
  onSetItems: (id: string, items: number[]) => void;
  onSetVerification: (id: string, v: Verification) => void;
  onSetHidden: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
  onReview?: (id: string, decision: "ACCEPT" | "REJECT") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isProposal = fragment.reviewState === "PROPOSED";

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`note group ${isProposal ? "note-proposed" : ""} ${
        isDragging ? "z-50 opacity-40" : ""
      } ${fragment.hidden ? "note-hidden" : ""} ${editable && !editing ? "cursor-grab" : ""}`}
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

      {/* ── Items de la dimension ──────────────────────────────────────────
          Un fragmento casi siempre habla de una faceta concreta de su fila:
          "Clientes" y no "Mercado" en general. Marcarlo deja ver de un vistazo
          si una dimension esta llena pero apilada en una sola faceta, que es un
          punto ciego que el conteo por celda no revela. */}
      {items.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1">
          {items.map((nombre, i) => {
            const activo = fragment.items.includes(i);
            const color = colorDeItem(i);
            return (
              <button
                key={nombre}
                type="button"
                disabled={!editable}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetItems(
                    fragment.id,
                    activo
                      ? fragment.items.filter((x) => x !== i)
                      : [...fragment.items, i],
                  );
                }}
                title={`${nombre}${editable ? (activo ? " · quitar" : " · marcar") : ""}`}
                aria-pressed={activo}
                aria-label={nombre}
                className="grid h-[13px] w-[13px] place-items-center disabled:cursor-default"
              >
                <span
                  className="block rounded-full transition-all"
                  style={{
                    width: activo ? 8 : 6,
                    height: activo ? 8 : 6,
                    background: activo ? color : "transparent",
                    // Sin marcar queda el contorno: se ve que la faceta existe
                    // y esta libre, en vez de desaparecer del post-it.
                    boxShadow: activo ? "none" : `inset 0 0 0 1.2px ${color}66`,
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

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

        {fragment.hidden && (
          <span
            title="Oculto del mapa. Sigue guardado."
            className="grid h-[14px] w-[14px] place-items-center text-noteInk/55"
          >
            <Ojo tachado />
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
          <span className="flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSetHidden(fragment.id, !fragment.hidden)}
              className="grid h-[18px] w-[18px] place-items-center rounded-full text-noteInk/45 transition hover:bg-black/10 hover:text-noteInk"
              aria-label={fragment.hidden ? "Devolver al mapa" : "Ocultar del mapa"}
              title={
                fragment.hidden
                  ? "Devolver al mapa"
                  : "Ocultar del mapa sin borrarlo. Se recupera con el boton Ocultos."
              }
            >
              {/* El icono muestra la ACCION, no el estado: sobre un fragmento
                  visible ofrece taparlo; sobre uno oculto, destaparlo. El
                  estado ya lo indica el ojo tachado fijo del pie. */}
              <Ojo tachado={!fragment.hidden} />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (menu) onDelete(fragment.id);
                else setMenu(true);
              }}
              onMouseLeave={() => setMenu(false)}
              className="font-ui text-[10px] leading-none text-noteInk/45 hover:text-danger"
              title={menu ? "Confirmar: eliminar el fragmento" : "Eliminar"}
            >
              {menu ? "eliminar?" : "×"}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/** Ojo abierto: el fragmento se ve. Ojo tachado: esta oculto. */
function Ojo({ tachado }: { tachado: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[13px] w-[13px]"
      aria-hidden
    >
      {tachado ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A9.9 9.9 0 0112 5c5 0 9 4.5 9 7a12 12 0 01-2.4 3.4" />
          <path d="M6.5 6.8C4.2 8.3 3 10.4 3 12c0 2.5 4 7 9 7a9.6 9.6 0 004.2-.95" />
          <path d="M9.9 9.9a3 3 0 004.2 4.2" />
        </>
      ) : (
        <>
          <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )}
    </svg>
  );
}
