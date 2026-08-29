"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { TemplateShape } from "@/lib/templates";
import { VERIFICATION_META, VERIFICATIONS, type Verification } from "@/lib/enums";
import { reviewFragment } from "@/app/actions/fragments";

export type Proposal = {
  id: string;
  rowId: string;
  colId: string;
  text: string;
  verification: Verification;
  sourceUrl: string | null;
  sourceCitation: string | null;
  agentRationale: string | null;
};

/**
 * Revisar, corregir y decidir.
 *
 * Cada propuesta se puede editar antes de aceptarla — texto, celda y estado de
 * verificacion. Esa es la etapa donde el equipo se queda: el agente propone, la
 * persona decide.
 */
export function ReviewQueue({
  shape,
  proposals,
  editable,
}: {
  slug: string;
  shape: TemplateShape;
  proposals: Proposal[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Partial<Proposal>>>({});
  const [error, setError] = useState<string | null>(null);

  const rowName = (id: string) => shape.rows.find((r) => r.id === id)?.name ?? id;
  const colName = (id: string) => shape.cols.find((c) => c.id === id)?.name ?? id;

  function decide(p: Proposal, decision: "ACCEPT" | "REJECT") {
    const draft = drafts[p.id] ?? {};
    setDone((s) => new Set(s).add(p.id));
    setError(null);
    startTransition(async () => {
      try {
        await reviewFragment(p.id, decision, {
          text: draft.text ?? p.text,
          rowId: draft.rowId ?? p.rowId,
          colId: draft.colId ?? p.colId,
          verification: draft.verification ?? p.verification,
        });
        router.refresh();
      } catch (e) {
        setDone((s) => {
          const n = new Set(s);
          n.delete(p.id);
          return n;
        });
        setError(e instanceof Error ? e.message : "No se pudo registrar la decision.");
      }
    });
  }

  const visible = proposals.filter((p) => !done.has(p.id));

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-[3px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] px-3 py-2 text-[12px] text-[#e8a99c]">
          {error}
        </p>
      )}

      {visible.map((p) => {
        const d = drafts[p.id] ?? {};
        const verification = d.verification ?? p.verification;
        const meta = VERIFICATION_META[verification];

        return (
          <article
            key={p.id}
            className="rounded-[4px] border border-[rgba(232,227,216,0.12)] bg-panel p-4"
          >
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[280px] flex-1">
                <textarea
                  defaultValue={p.text}
                  rows={2}
                  disabled={!editable}
                  onChange={(e) =>
                    setDrafts((s) => ({ ...s, [p.id]: { ...s[p.id], text: e.target.value } }))
                  }
                  className="field font-hand text-[16px] leading-snug"
                />

                {p.agentRationale && (
                  <p className="mt-2 text-[11.5px] leading-relaxed text-[#7f8f8c]">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#5e7370]">
                      por que aqui
                    </span>{" "}
                    {p.agentRationale}
                  </p>
                )}

                {(p.sourceUrl || p.sourceCitation) && (
                  <p className="mt-1.5 text-[11.5px]">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#5e7370]">
                      fuente
                    </span>{" "}
                    {p.sourceUrl ? (
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-accent underline"
                      >
                        {p.sourceCitation || p.sourceUrl}
                      </a>
                    ) : (
                      <span className="text-[#8b9a97]">{p.sourceCitation}</span>
                    )}
                  </p>
                )}
              </div>

              <div className="flex w-[230px] flex-col gap-2">
                <div className="flex gap-2">
                  <select
                    defaultValue={p.rowId}
                    disabled={!editable}
                    onChange={(e) =>
                      setDrafts((s) => ({ ...s, [p.id]: { ...s[p.id], rowId: e.target.value } }))
                    }
                    className="field px-2 py-1.5 text-[11.5px]"
                    title={`Dimension actual: ${rowName(p.rowId)}`}
                  >
                    {shape.rows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <select
                    defaultValue={p.colId}
                    disabled={!editable}
                    onChange={(e) =>
                      setDrafts((s) => ({ ...s, [p.id]: { ...s[p.id], colId: e.target.value } }))
                    }
                    className="field px-2 py-1.5 text-[11.5px]"
                    title={`Lente actual: ${colName(p.colId)}`}
                  >
                    {shape.cols.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={verification}
                  disabled={!editable}
                  onChange={(e) =>
                    setDrafts((s) => ({
                      ...s,
                      [p.id]: { ...s[p.id], verification: e.target.value as Verification },
                    }))
                  }
                  className="field px-2 py-1.5 text-[11.5px]"
                  style={{ color: meta.color }}
                  title={meta.help}
                >
                  {VERIFICATIONS.map((v) => (
                    <option key={v} value={v}>
                      {VERIFICATION_META[v].dot} {VERIFICATION_META[v].label}
                    </option>
                  ))}
                </select>

                {editable && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide(p, "ACCEPT")}
                      disabled={pending}
                      className="btn btn-primary flex-1 justify-center"
                    >
                      Aceptar
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(p, "REJECT")}
                      disabled={pending}
                      className="btn btn-danger"
                    >
                      Descartar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}

      {visible.length === 0 && (
        <p className="hint">Revisaste todo lo que habia. Actualiza para ver si llego mas.</p>
      )}
    </div>
  );
}
