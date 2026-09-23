"use client";

import { useRef, useState, useTransition } from "react";

import {
  ARTIFACT_KINDS,
  ARTIFACT_KIND_LABEL,
  ARTIFACT_STATUSES,
  ARTIFACT_STATUS_META,
  ASSUMPTION_STATUS_META,
  CLAIM_KINDS,
  CLAIM_KIND_META,
  FEEDBACK_VERDICTS,
  FEEDBACK_VERDICT_META,
} from "@/lib/enums";
import { ITERACIONES_ARTEFACTO, MATRIZ_ARTEFACTOS } from "@/lib/gimi";
import {
  addClaim,
  addFeedback,
  deleteArtifact,
  deleteClaim,
  deleteFeedback,
  setArtifactAssumption,
  updateArtifact,
} from "@/app/actions/artifacts";
import type { ArtefactoVista, ConceptoOpcion } from "./types";

/**
 * La ficha de un artefacto.
 *
 * En el orden en que se usa: de que concepto sale, el documento, que supuestos
 * expone, que cifras muestra y que respondio la empresa. Lo ultimo es lo que
 * lo distingue de una presentacion: una presentacion se muestra y termina ahi.
 *
 * Los avisos no bloquean, como en las fichas de insight y de concepto. Un
 * bloqueo empujaria a exponer un supuesto cualquiera con tal de guardar.
 */
export function ArtifactCard({
  slug,
  artefacto: a,
  concepto,
  editable,
}: {
  slug: string;
  artefacto: ArtefactoVista;
  concepto: ConceptoOpcion | null;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [verDocumento, setVerDocumento] = useState(false);
  const marco = useRef<HTMLIFrameElement>(null);

  const [cifra, setCifra] = useState({ value: "", label: "", kind: "ESTIMACION", basis: "", fragmentId: "" });
  const [reaccion, setReaccion] = useState({ source: "", text: "", assumptionId: "", verdict: "" });

  const ruta = `/proyectos/${slug}/artefactos/${a.id}/documento`;
  const color = concepto?.color ?? "#5e7370";

  const sinSupuestoExpuesto = a.expuestos.length === 0;
  const estimacionesSinBase = a.cifras.filter((c) => c.kind === "ESTIMACION" && !c.basis).length;
  const presentadoSinReaccion = a.status === "PRESENTADO" && a.reacciones.length === 0;

  function correr(fn: () => Promise<unknown>, despues?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        despues?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <article className="panel flex flex-col gap-4" style={{ borderLeft: `3px solid ${color}` }}>
      {/* ── Cabecera ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-[24ch] flex-1">
          <p className="kicker" style={{ color }}>
            {ARTIFACT_KIND_LABEL[a.kind]}
            {concepto ? ` · ${concepto.title}` : " · sin concepto"}
            {concepto?.insights.length
              ? ` · Insight ${concepto.insights.map((i) => i.numero).join(" + ")}`
              : ""}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[#7d8a88]">
            <span
              style={{ color: a.iteration >= ITERACIONES_ARTEFACTO.minimo ? "#6FBFB2" : "#c9a94e" }}
              title="Hacer → probar con el mercado → revisar hallazgos → cambiar"
            >
              Vuelta {a.iteration} de {ITERACIONES_ARTEFACTO.minimo}
            </span>
            {editable && (
              <button
                type="button"
                disabled={pending}
                onClick={() => correr(() => updateArtifact(a.id, { iteration: a.iteration + 1 }))}
                className="rounded-[3px] border border-[rgba(232,227,216,0.18)] px-1.5 text-[#8b9a97] hover:text-accent"
                title="Registrar otra vuelta: se probó con el mercado y se hicieron cambios"
              >
                +1 vuelta
              </button>
            )}
            {(MATRIZ_ARTEFACTOS[a.kind] ?? []).length > 0 && (
              <span className="normal-case tracking-normal">
                · valida {(MATRIZ_ARTEFACTOS[a.kind] ?? []).join(", ").toLowerCase()}
              </span>
            )}
          </p>
          {editable ? (
            <input
              className="field mt-1.5 text-[16px] font-semibold"
              defaultValue={a.title}
              onBlur={(e) =>
                e.target.value !== a.title && correr(() => updateArtifact(a.id, { title: e.target.value }))
              }
            />
          ) : (
            <h3 className="mt-1 text-[16px] font-semibold text-[#e8e3d8]">{a.title}</h3>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable ? (
            <>
              <select
                className="field w-auto text-[12px]"
                value={a.kind}
                onChange={(e) => correr(() => updateArtifact(a.id, { kind: e.target.value }))}
              >
                {ARTIFACT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ARTIFACT_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <select
                className="field w-auto text-[12px]"
                value={a.status}
                style={{ color: ARTIFACT_STATUS_META[a.status].color }}
                onChange={(e) => correr(() => updateArtifact(a.id, { status: e.target.value }))}
              >
                {ARTIFACT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ARTIFACT_STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <span className="text-[12px]" style={{ color: ARTIFACT_STATUS_META[a.status].color }}>
              {ARTIFACT_STATUS_META[a.status].label}
            </span>
          )}
        </div>
      </div>

      {/* ── Promesa ────────────────────────────────────────────────────── */}
      <div>
        <label className="label">Lo que la empresa tiene que entender al verlo</label>
        {editable ? (
          <textarea
            className="field resize-y text-[13px]"
            rows={2}
            defaultValue={a.promise}
            onBlur={(e) =>
              e.target.value !== a.promise && correr(() => updateArtifact(a.id, { promise: e.target.value }))
            }
          />
        ) : (
          <p className="text-[13px] text-[#a9b5b3]">{a.promise || "—"}</p>
        )}
      </div>

      {a.status === "PRESENTADO" && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="label">Presentado a</label>
            {editable ? (
              <input
                className="field text-[12.5px]"
                defaultValue={a.presentedTo}
                placeholder="Empresa, área o personas"
                onBlur={(e) =>
                  e.target.value !== a.presentedTo &&
                  correr(() => updateArtifact(a.id, { presentedTo: e.target.value }))
                }
              />
            ) : (
              <p className="text-[12.5px] text-[#a9b5b3]">{a.presentedTo || "—"}</p>
            )}
          </div>
          {a.presentedAt && (
            <p className="text-[11.5px] text-[#8b9a97]">
              el {new Date(a.presentedAt).toLocaleDateString("es-CO")}
            </p>
          )}
        </div>
      )}

      {/* ── Avisos ─────────────────────────────────────────────────────── */}
      {(sinSupuestoExpuesto || estimacionesSinBase > 0 || presentadoSinReaccion || !a.tieneDocumento) && (
        <ul className="flex flex-col gap-1 rounded-[4px] border border-dashed border-[rgba(201,162,39,0.4)] p-2.5">
          {!a.tieneDocumento && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              Todavía no tiene documento cargado. Se carga desde el servidor con{" "}
              <code className="font-mono">npm run artefacto:cargar -- {a.id} archivo.html</code>.
            </li>
          )}
          {sinSupuestoExpuesto && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              No expone ningún supuesto. Así solo vende, y la empresa va a responder con cortesía en
              vez de con crítica.
            </li>
          )}
          {estimacionesSinBase > 0 && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              {estimacionesSinBase} estimación{estimacionesSinBase === 1 ? "" : "es"} sin decir de
              dónde sale. Es la primera pregunta que va a hacer la empresa.
            </li>
          )}
          {presentadoSinReaccion && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              Está presentado y no tiene ninguna reacción registrada. Sin eso es otra presentación.
            </li>
          )}
        </ul>
      )}

      {/* ── Documento ──────────────────────────────────────────────────── */}
      {a.tieneDocumento && (
        <div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={() => setVerDocumento((v) => !v)}>
              {verDocumento ? "Ocultar el artefacto" : "Ver el artefacto"}
            </button>
            <a href={ruta} target="_blank" rel="noreferrer" className="btn">
              Abrir aparte
            </a>
            {verDocumento && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  marco.current?.contentWindow?.focus();
                  marco.current?.contentWindow?.print();
                }}
              >
                Exportar a PDF
              </button>
            )}
          </div>
          {verDocumento && (
            <iframe
              ref={marco}
              src={ruta}
              title={a.title}
              className="mt-3 h-[70vh] min-h-[420px] w-full rounded-[6px] border border-[rgba(232,227,216,0.14)] bg-white"
            />
          )}
        </div>
      )}

      {/* ── Supuestos expuestos ────────────────────────────────────────── */}
      <div>
        <p className="kicker mb-2">Supuestos que expone</p>
        {!concepto || concepto.supuestos.length === 0 ? (
          <p className="text-[12px] text-[#8b9a97]">
            El concepto no tiene supuestos. Se escriben en Convergir.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {concepto.supuestos.map((s) => {
              const marcado = a.expuestos.includes(s.id);
              return (
                <li key={s.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-[3px]"
                    checked={marcado}
                    disabled={!editable || pending}
                    onChange={(e) => correr(() => setArtifactAssumption(a.id, s.id, e.target.checked))}
                  />
                  <span className="flex-1 text-[12.5px] leading-snug text-[#cbd4d2]">{s.text}</span>
                  <span className="font-mono text-[10px] text-[#8b9a97]" title="Probabilidad de 1 a 5">
                    {s.likelihood}/5
                  </span>
                  <span className="text-[10.5px]" style={{ color: ASSUMPTION_STATUS_META[s.status].color }}>
                    {ASSUMPTION_STATUS_META[s.status].label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Cifras ─────────────────────────────────────────────────────── */}
      <div>
        <p className="kicker mb-2">Cifras que muestra ({a.cifras.length})</p>
        <ul className="flex flex-col gap-2">
          {a.cifras.map((c) => (
            <li key={c.id} className="group flex items-start gap-3">
              <span className="min-w-[7ch] font-mono text-[13px] font-semibold text-[#e8e3d8]">{c.value}</span>
              <div className="flex-1">
                <p className="text-[12.5px] text-[#cbd4d2]">
                  {c.label}{" "}
                  <span className="text-[10.5px]" style={{ color: CLAIM_KIND_META[c.kind].color }}>
                    · {CLAIM_KIND_META[c.kind].label}
                  </span>
                </p>
                {(c.fragmento || c.basis) && (
                  <p className="text-[11px] leading-snug text-[#8b9a97]">{c.fragmento ?? c.basis}</p>
                )}
              </div>
              {editable && (
                <button
                  type="button"
                  className="text-[12px] text-[#5e7370] opacity-0 transition hover:text-[#e0653d] group-hover:opacity-100"
                  onClick={() => correr(() => deleteClaim(c.id))}
                  aria-label="Quitar cifra"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>

        {editable && (
          <div className="mt-3 grid gap-2 sm:grid-cols-[8ch_1fr_auto]">
            <input
              className="field text-[12.5px]"
              placeholder="12-20%"
              value={cifra.value}
              onChange={(e) => setCifra({ ...cifra, value: e.target.value })}
            />
            <input
              className="field text-[12.5px]"
              placeholder="Qué mide"
              value={cifra.label}
              onChange={(e) => setCifra({ ...cifra, label: e.target.value })}
            />
            <select
              className="field w-auto text-[12.5px]"
              value={cifra.kind}
              title={CLAIM_KIND_META[cifra.kind as keyof typeof CLAIM_KIND_META].help}
              onChange={(e) => setCifra({ ...cifra, kind: e.target.value })}
            >
              {CLAIM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {CLAIM_KIND_META[k].label}
                </option>
              ))}
            </select>
            {cifra.kind === "HECHO" ? (
              <select
                className="field text-[12.5px] sm:col-span-3"
                value={cifra.fragmentId}
                onChange={(e) => setCifra({ ...cifra, fragmentId: e.target.value })}
              >
                <option value="">Fragmento del mapa que la sostiene…</option>
                {(concepto?.fragmentos ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.text.length > 110 ? `${f.text.slice(0, 110)}…` : f.text}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="field text-[12.5px] sm:col-span-3"
                placeholder={cifra.kind === "META" ? "Por qué es la meta (opcional)" : "De dónde sale la estimación"}
                value={cifra.basis}
                onChange={(e) => setCifra({ ...cifra, basis: e.target.value })}
              />
            )}
            <div className="sm:col-span-3">
              <button
                type="button"
                className="btn"
                disabled={pending || !cifra.value.trim() || !cifra.label.trim()}
                onClick={() =>
                  correr(
                    () =>
                      addClaim(a.id, {
                        ...cifra,
                        fragmentId: cifra.kind === "HECHO" ? cifra.fragmentId : undefined,
                      }),
                    () => setCifra({ value: "", label: "", kind: "ESTIMACION", basis: "", fragmentId: "" }),
                  )
                }
              >
                Añadir cifra
              </button>
              {cifra.kind === "HECHO" && !cifra.fragmentId && (
                <span className="ml-2 text-[11px] text-[#c9a94e]">
                  Sin fragmento se guardará como estimación.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Lo que respondió la empresa ────────────────────────────────── */}
      <div>
        <p className="kicker mb-2">Lo que respondió la empresa ({a.reacciones.length})</p>
        <ul className="flex flex-col gap-2.5">
          {a.reacciones.map((r) => (
            <li key={r.id} className="group border-l-2 border-[rgba(232,227,216,0.14)] pl-3">
              <p className="text-[12.5px] leading-snug text-[#cbd4d2]">«{r.text}»</p>
              <p className="mt-0.5 text-[11px] text-[#8b9a97]">
                {r.source || "La empresa"} · {new Date(r.fecha).toLocaleDateString("es-CO")}
                {r.verdict && (
                  <span style={{ color: FEEDBACK_VERDICT_META[r.verdict].color }}>
                    {" "}
                    · {FEEDBACK_VERDICT_META[r.verdict].label}
                  </span>
                )}
                {editable && (
                  <button
                    type="button"
                    className="ml-2 text-[#5e7370] opacity-0 transition hover:text-[#e0653d] group-hover:opacity-100"
                    onClick={() => correr(() => deleteFeedback(r.id))}
                  >
                    borrar
                  </button>
                )}
              </p>
              {r.supuesto && <p className="text-[11px] italic text-[#5e8c86]">Sobre: {r.supuesto}</p>}
            </li>
          ))}
        </ul>

        {editable && (
          <div className="mt-3 flex flex-col gap-2">
            <textarea
              className="field resize-y text-[12.5px]"
              rows={2}
              placeholder="Lo que dijeron, lo más literal posible."
              value={reaccion.text}
              onChange={(e) => setReaccion({ ...reaccion, text: e.target.value })}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                className="field text-[12.5px]"
                placeholder="Quién lo dijo"
                value={reaccion.source}
                onChange={(e) => setReaccion({ ...reaccion, source: e.target.value })}
              />
              <select
                className="field text-[12.5px]"
                value={reaccion.assumptionId}
                onChange={(e) => setReaccion({ ...reaccion, assumptionId: e.target.value, verdict: "" })}
              >
                <option value="">No responde a un supuesto</option>
                {(concepto?.supuestos ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.text.length > 60 ? `${s.text.slice(0, 60)}…` : s.text}
                  </option>
                ))}
              </select>
              <select
                className="field text-[12.5px]"
                value={reaccion.verdict}
                disabled={!reaccion.assumptionId}
                onChange={(e) => setReaccion({ ...reaccion, verdict: e.target.value })}
              >
                <option value="">Sin veredicto</option>
                {FEEDBACK_VERDICTS.map((v) => (
                  <option key={v} value={v}>
                    {FEEDBACK_VERDICT_META[v].label}
                  </option>
                ))}
              </select>
            </div>
            {(reaccion.verdict === "CONFIRMA" || reaccion.verdict === "REFUTA") && (
              <p className="text-[11px] text-[#c9a94e]">
                Al guardar, el supuesto pasa a {reaccion.verdict === "CONFIRMA" ? "confirmado" : "refutado"} también
                en Convergir, con esta reacción en su nota.
              </p>
            )}
            <div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending || !reaccion.text.trim()}
                onClick={() =>
                  correr(
                    () =>
                      addFeedback(a.id, {
                        ...reaccion,
                        assumptionId: reaccion.assumptionId || undefined,
                        verdict: reaccion.verdict || undefined,
                      }),
                    () => setReaccion({ source: "", text: "", assumptionId: "", verdict: "" }),
                  )
                }
              >
                Registrar reacción
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-[12px] text-[#e0653d]">{error}</p>}

      {editable && (
        <div className="border-t border-[rgba(232,227,216,0.1)] pt-3">
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() => {
              if (confirm(`¿Borrar el artefacto «${a.title}» con sus cifras y reacciones?`)) {
                correr(() => deleteArtifact(a.id));
              }
            }}
          >
            Borrar artefacto
          </button>
        </div>
      )}
    </article>
  );
}
