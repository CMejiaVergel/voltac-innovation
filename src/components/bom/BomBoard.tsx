"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { THIN_CELL_THRESHOLD } from "@/lib/gimi";
import { VERIFICATION_META, type Verification } from "@/lib/enums";
import {
  createFragment,
  deleteFragment,
  moveFragment,
  reviewFragment,
  setVerification,
  updateFragmentText,
} from "@/app/actions/fragments";

import { Note } from "./Note";
import { BomMobile } from "./BomMobile";
import type { BoardFragment, BoardProps } from "./types";

/**
 * El tablero.
 *
 * Mantiene su propia copia de los fragmentos para responder de inmediato al
 * usuario y llama a la accion de servidor detras. Si la accion falla, se
 * revierte el cambio local y se muestra el error: nunca se deja una pantalla
 * que miente sobre lo que quedo guardado.
 */
export function BomBoard({ mapId, shape, fragments, editable }: BoardProps) {
  const [items, setItems] = useState<BoardFragment[]>(fragments);
  const [dragging, setDragging] = useState<BoardFragment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGaps, setShowGaps] = useState(true);
  const [showVerification, setShowVerification] = useState(true);
  const [showProposals, setShowProposals] = useState(true);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const visible = useMemo(
    () => items.filter((f) => f.reviewState === "ACCEPTED" || (showProposals && f.reviewState === "PROPOSED")),
    [items, showProposals],
  );

  const byCell = useMemo(() => {
    const m = new Map<string, BoardFragment[]>();
    for (const f of visible) {
      const k = `${f.rowId}|${f.colId}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(f);
    }
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          Number(a.reviewState === "PROPOSED") - Number(b.reviewState === "PROPOSED") ||
          a.position - b.position,
      );
    }
    return m;
  }, [visible]);

  const acceptedCount = items.filter((f) => f.reviewState === "ACCEPTED").length;
  const proposedCount = items.filter((f) => f.reviewState === "PROPOSED").length;

  // ── Mutaciones con reversion en caso de fallo ──────────────────────────────

  function run(optimistic: () => void, revert: () => void, action: () => Promise<unknown>) {
    optimistic();
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        revert();
        setError(e instanceof Error ? e.message : "No se pudo guardar el cambio.");
      }
    });
  }

  function handleEditText(id: string, text: string) {
    const before = items.find((f) => f.id === id)?.text ?? "";
    run(
      () => setItems((s) => s.map((f) => (f.id === id ? { ...f, text } : f))),
      () => setItems((s) => s.map((f) => (f.id === id ? { ...f, text: before } : f))),
      () => updateFragmentText(id, text),
    );
  }

  function handleVerification(id: string, v: Verification) {
    const before = items.find((f) => f.id === id)?.verification ?? "TO_CONFIRM";
    run(
      () => setItems((s) => s.map((f) => (f.id === id ? { ...f, verification: v } : f))),
      () => setItems((s) => s.map((f) => (f.id === id ? { ...f, verification: before } : f))),
      () => setVerification(id, v),
    );
  }

  function handleDelete(id: string) {
    const before = items;
    run(
      () => setItems((s) => s.filter((f) => f.id !== id)),
      () => setItems(before),
      () => deleteFragment(id),
    );
  }

  function handleReview(id: string, decision: "ACCEPT" | "REJECT") {
    const before = items;
    run(
      () =>
        setItems((s) =>
          decision === "REJECT"
            ? s.filter((f) => f.id !== id)
            : s.map((f) => (f.id === id ? { ...f, reviewState: "ACCEPTED" as const } : f)),
        ),
      () => setItems(before),
      () => reviewFragment(id, decision),
    );
  }

  async function handleAdd(rowId: string, colId: string) {
    const text = "Nuevo fragmento";
    const tempId = `temp-${Date.now()}`;
    const optimistic: BoardFragment = {
      id: tempId,
      rowId,
      colId,
      text,
      position: 9999,
      verification: "TO_CONFIRM",
      reviewState: "ACCEPTED",
      origin: "HUMAN",
      sourceUrl: null,
      sourceCitation: null,
      agentRationale: null,
      authorName: null,
      updatedAt: new Date().toISOString(),
    };
    setItems((s) => [...s, optimistic]);
    setError(null);
    try {
      const { id } = await createFragment({ mapId, rowId, colId, text });
      setItems((s) => s.map((f) => (f.id === tempId ? { ...f, id } : f)));
    } catch (e) {
      setItems((s) => s.filter((f) => f.id !== tempId));
      setError(e instanceof Error ? e.message : "No se pudo crear el fragmento.");
    }
  }

  function handleDragStart(e: DragStartEvent) {
    setDragging(items.find((f) => f.id === e.active.id) ?? null);
  }

  function handleMove(id: string, rowId: string, colId: string) {
    const fragment = items.find((f) => f.id === id);
    if (!fragment || (fragment.rowId === rowId && fragment.colId === colId)) return;
    const before = items;
    run(
      () => setItems((s) => s.map((f) => (f.id === id ? { ...f, rowId, colId, position: 9999 } : f))),
      () => setItems(before),
      () => moveFragment(id, rowId, colId),
    );
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragging(null);
    const overId = e.over?.id;
    if (!overId || typeof overId !== "string") return;

    const [rowId, colId] = overId.split("|");
    handleMove(String(e.active.id), rowId, colId);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const gridCols = `118px repeat(${shape.cols.length}, minmax(0, 1fr))`;

  return (
    <div>
      {/* Barra de herramientas */}
      <div className="no-print sticky top-[52px] z-40 -mx-4 flex flex-wrap items-center gap-2 overflow-x-auto border-b border-[rgba(232,227,216,0.14)] bg-[rgba(18,24,27,0.95)] px-4 py-2.5 backdrop-blur md:-mx-[18px] md:px-[18px]">
        <button
          type="button"
          onClick={() => setShowGaps((v) => !v)}
          className={`btn ${showGaps ? "btn-primary" : ""}`}
          title={`Raya las celdas con menos de ${THIN_CELL_THRESHOLD} fragmentos`}
        >
          Vacios
        </button>
        <button
          type="button"
          onClick={() => setShowVerification((v) => !v)}
          className={`btn ${showVerification ? "btn-primary" : ""}`}
        >
          Verificacion
        </button>
        {proposedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowProposals((v) => !v)}
            className={`btn ${showProposals ? "btn-primary" : ""}`}
          >
            Propuestas del agente ({proposedCount})
          </button>
        )}
        <button type="button" onClick={() => window.print()} className="btn hidden md:inline-flex">
          Imprimir / PDF
        </button>

        <span className="flex-1" />
        <span className="font-mono text-[11px] text-[#5e7370]">
          {acceptedCount} fragmentos
        </span>
      </div>

      {error && (
        <p className="no-print mt-3 rounded-[3px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] px-3 py-2 text-[12px] text-[#e8a99c]">
          {error}
        </p>
      )}

      {/* Vista de telefono: un lente a la vez. Ver BomMobile. */}
      <BomMobile
        shape={shape}
        byCell={byCell}
        editable={editable}
        showGaps={showGaps}
        onAdd={handleAdd}
        onEditText={handleEditText}
        onSetVerification={handleVerification}
        onDelete={handleDelete}
        onReview={handleReview}
        onMove={handleMove}
      />

      {/* Rejilla completa: escritorio e impresion. */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="board-shell mt-4 hidden md:block print:block">
          <div className="board">
            {/* Encabezado de columnas */}
            <div
              className="sticky top-0 z-20 grid border-b-2 border-ink bg-boardAlt"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="flex items-end px-2.5 py-3">
                <span className="font-mono text-[9.5px] uppercase leading-tight tracking-[0.12em] text-muted">
                  Dimension
                  <br />× Lente
                </span>
              </div>
              {shape.cols.map((c) => {
                const n = shape.rows.reduce(
                  (a, r) => a + (byCell.get(`${r.id}|${c.id}`)?.length ?? 0),
                  0,
                );
                return (
                  <div key={c.id} className="border-l border-boardLine px-3 pb-2.5 pt-3">
                    <span className="float-right font-mono text-[9.5px] text-muted">{n}</span>
                    <h2 className="text-[14.5px] font-bold leading-tight tracking-[-0.01em] text-ink">
                      {c.name}
                    </h2>
                    <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{c.question}</p>
                  </div>
                );
              })}
            </div>

            {/* Filas */}
            {shape.rows.map((r) => {
              const total = shape.cols.reduce(
                (a, c) => a + (byCell.get(`${r.id}|${c.id}`)?.length ?? 0),
                0,
              );
              return (
                <div
                  key={r.id}
                  className="grid border-b border-boardLine last:border-b-0"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div
                    className="flex flex-col px-2.5 py-3.5 text-white"
                    style={{ background: r.color }}
                  >
                    <span className="text-[17px] font-bold leading-none tracking-[-0.02em]">
                      {r.name}
                    </span>
                    <span className="mt-1.5 text-[10px] leading-snug text-white/80">
                      {r.facets}
                    </span>
                    <span className="mt-auto pt-2 font-mono text-[9.5px] text-white/65">
                      {total}
                    </span>
                  </div>

                  {shape.cols.map((c) => (
                    <Cell
                      key={c.id}
                      rowId={r.id}
                      colId={c.id}
                      hint={c.hint}
                      fragments={byCell.get(`${r.id}|${c.id}`) ?? []}
                      editable={editable}
                      showGaps={showGaps}
                      showVerification={showVerification}
                      onAdd={handleAdd}
                      onEditText={handleEditText}
                      onSetVerification={handleVerification}
                      onDelete={handleDelete}
                      onReview={handleReview}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="note rotate-2 shadow-[3px_6px_14px_rgba(0,0,0,0.35)]">
              {dragging.text}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Leyenda metodologica */}
      <div className="no-print mt-6 grid gap-6 text-[12.5px] leading-relaxed text-[#93a09e] md:grid-cols-3">
        <div>
          <h3 className="kicker mb-2">Como se llena</h3>
          <p>
            Fragmentos crudos, una idea por papelito. Se anota aunque no encaje con nada. Los
            insights se leen despues, sobre el mapa lleno — no se escriben aqui.
          </p>
        </div>
        <div>
          <h3 className="kicker mb-2">Verificacion</h3>
          <ul className="flex flex-col gap-1">
            {(["VERIFIED", "TO_CONFIRM", "ASSUMPTION"] as Verification[]).map((v) => (
              <li key={v}>
                <span style={{ color: VERIFICATION_META[v].color }}>
                  {VERIFICATION_META[v].dot} {VERIFICATION_META[v].short}
                </span>{" "}
                <b className="text-[#cbd4d2]">{VERIFICATION_META[v].label}.</b>{" "}
                {VERIFICATION_META[v].help}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="kicker mb-2">Adyacencias</h3>
          <p>
            Se registra el <b className="text-[#cbd4d2]">mecanismo trasladable</b>, no el nombre
            de la empresa. &ldquo;Coca-Cola&rdquo; no sirve; &ldquo;devuelve a la cuenca el agua
            que consume mediante programas de reposicion&rdquo; si.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Cell({
  rowId,
  colId,
  hint,
  fragments,
  editable,
  showGaps,
  showVerification,
  onAdd,
  onEditText,
  onSetVerification,
  onDelete,
  onReview,
}: {
  rowId: string;
  colId: string;
  hint: string;
  fragments: BoardFragment[];
  editable: boolean;
  showGaps: boolean;
  showVerification: boolean;
  onAdd: (rowId: string, colId: string) => void;
  onEditText: (id: string, text: string) => void;
  onSetVerification: (id: string, v: Verification) => void;
  onDelete: (id: string) => void;
  onReview: (id: string, decision: "ACCEPT" | "REJECT") => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${rowId}|${colId}` });

  const accepted = fragments.filter((f) => f.reviewState === "ACCEPTED").length;
  const thin = showGaps && accepted < THIN_CELL_THRESHOLD;

  return (
    <div
      ref={setNodeRef}
      className={`board-cell ${thin ? "is-thin" : ""} ${isOver ? "is-over" : ""}`}
    >
      {fragments.map((f) => (
        <Note
          key={f.id}
          fragment={f}
          editable={editable}
          showVerification={showVerification}
          onEditText={onEditText}
          onSetVerification={onSetVerification}
          onDelete={onDelete}
          onReview={onReview}
        />
      ))}

      {editable && (
        <button
          type="button"
          onClick={() => onAdd(rowId, colId)}
          title={hint}
          className="no-print mt-auto rounded-[2px] border border-dashed border-boardLine px-1.5 py-1 text-left text-[11px] text-[#9c958a] transition hover:border-[#77706a] hover:text-[#77706a]"
        >
          + fragmento
        </button>
      )}
    </div>
  );
}
