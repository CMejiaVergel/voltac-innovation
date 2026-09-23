"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { ARTEFACTO } from "@/lib/gimi";
import { ARTIFACT_KINDS, ARTIFACT_KIND_LABEL } from "@/lib/enums";
import { createArtifact } from "@/app/actions/artifacts";
import { ArtifactCard } from "./ArtifactCard";
import { GuiaTaller } from "./GuiaTaller";
import type { ArtefactoVista, ConceptoOpcion } from "./types";

/**
 * El tablero de la etapa Actuar.
 *
 * Las reglas del artefacto van arriba y a la vista, no en una ayuda plegada.
 * Son pocas y son justo las que se olvidan con prisa: que el artefacto sale de
 * un concepto, que expone un supuesto, que las cifras dicen que son.
 */
export function ArtifactBoard({
  slug,
  artefactos,
  conceptos,
  editable,
}: {
  slug: string;
  artefactos: ArtefactoVista[];
  conceptos: ConceptoOpcion[];
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [conceptId, setConceptId] = useState(conceptos[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("BROCHURE");
  const [promise, setPromise] = useState("");

  const porConcepto = new Map(conceptos.map((c) => [c.id, c]));

  function crear() {
    setError(null);
    startTransition(async () => {
      try {
        await createArtifact(slug, { conceptId, title, kind, promise });
        setTitle("");
        setPromise("");
        setCreando(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo crear.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Que es y sus reglas ─────────────────────────────────────────── */}
      <div className="max-w-[74ch]">
        <p className="kicker mb-2">Etapa 5 · Actuar · Artefactos de innovación</p>
        <p className="hint">{ARTEFACTO.definicion}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#8b9a97]">{ARTEFACTO.frenteAlMvp}</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {ARTEFACTO.reglas.map((r) => (
            <li key={r} className="flex gap-2 text-[12px] leading-snug text-[#a9b5b3]">
              <span className="text-accent">·</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Sin conceptos no hay de donde colgarlo ──────────────────────── */}
      {conceptos.length === 0 ? (
        <div className="panel max-w-[68ch]">
          <p className="text-[13px] leading-relaxed text-[#a9b5b3]">
            Este proyecto todavía no tiene conceptos de solución, y un artefacto cuelga de uno.
            Los conceptos se arman en{" "}
            <Link href={`/proyectos/${slug}/convergir`} className="text-accent underline">
              Convergir
            </Link>{" "}
            juntando ideas de uno o varios insights, con sus supuestos. Ahí se escala la solución;
            aquí se hace tangible.
          </p>
        </div>
      ) : (
        editable && (
          <div>
            {!creando ? (
              <button type="button" className="btn btn-primary" onClick={() => setCreando(true)}>
                Nuevo artefacto
              </button>
            ) : (
              <div className="panel flex max-w-[68ch] flex-col gap-3">
                <div>
                  <label className="label">Concepto de solución</label>
                  <select
                    className="field text-[13px]"
                    value={conceptId}
                    onChange={(e) => setConceptId(e.target.value)}
                  >
                    {conceptos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                        {c.insights.length
                          ? ` · Insight ${c.insights.map((i) => i.numero).join(" + ")}`
                          : ""}
                      </option>
                    ))}
                  </select>
                  {porConcepto.get(conceptId)?.supuestos.length === 0 && (
                    <p className="mt-1.5 text-[11.5px] text-[#c9a94e]">
                      Este concepto no tiene supuestos. El artefacto no va a poder exponer ninguno:
                      conviene escribirlos en Convergir antes de presentarlo.
                    </p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label className="label">Nombre</label>
                    <input
                      className="field text-[13px]"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ej. Custodio de datos del corredor"
                    />
                  </div>
                  <div>
                    <label className="label">Formato</label>
                    <select
                      className="field text-[13px]"
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                    >
                      {ARTIFACT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {ARTIFACT_KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Lo que la empresa tiene que entender al verlo</label>
                  <textarea
                    className="field resize-y text-[13px]"
                    rows={2}
                    value={promise}
                    onChange={(e) => setPromise(e.target.value)}
                    placeholder="Una frase."
                  />
                </div>
                {error && <p className="text-[12px] text-[#e0653d]">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={pending || !title.trim() || !conceptId}
                    onClick={crear}
                  >
                    Crear
                  </button>
                  <button type="button" className="btn" onClick={() => setCreando(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      <GuiaTaller conceptos={conceptos} />

      {/* ── Los artefactos ──────────────────────────────────────────────── */}
      {artefactos.length === 0 && conceptos.length > 0 && (
        <p className="text-[12.5px] text-[#8b9a97]">Todavía no hay artefactos.</p>
      )}
      {artefactos.map((a) => (
        <ArtifactCard
          key={a.id}
          slug={slug}
          artefacto={a}
          concepto={a.conceptId ? (porConcepto.get(a.conceptId) ?? null) : null}
          editable={editable}
        />
      ))}
    </div>
  );
}
