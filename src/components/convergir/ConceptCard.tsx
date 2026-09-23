"use client";

import { useState, useTransition } from "react";

import {
  colorDeTrazo,
  promedioEje,
  puntuados,
  SUBCRITERIOS,
  PROBABILIDAD,
  ASSUMPTION_STATUS_META,
  type AssumptionStatus,
} from "@/lib/enums";
import {
  CONECTE_LOS_PUNTOS,
  DETONANTES,
  INGENIERIA_INVERSA,
  PREGUNTAS_ROBUSTAS,
  TIPOS_CONCEPTO,
  fraseConectada,
} from "@/lib/gimi";
import {
  addAssumption,
  assumptionToQuestion,
  deleteAssumption,
  deleteConcept,
  removeConceptSource,
  scoreConcept,
  updateAssumption,
  updateConcept,
  updateLienzo,
  type CampoConcepto,
} from "@/app/actions/concepts";
import type { ConceptoVista, DimensionVista, SupuestoVista } from "./types";

/**
 * La ficha de un concepto de negocio, en el orden del Taller 3.
 *
 *   1. La frase que conecta los puntos y la propuesta de valor (Ejercicio 1.1).
 *   2. El lienzo por dimension y los fragmentos del mapa que lo sostienen.
 *   3. La priorizacion por atractividad y fit (Ejercicio 2).
 *   4. La ingenieria inversa: que tiene que llegar a existir, las tres
 *      condiciones menos probables y su prueba de falla rapida.
 *   5. De donde sale: las ideas de Combinar.
 *
 * Las condiciones van ordenadas por probabilidad ASCENDENTE — lo improbable
 * primero. Es al reves de lo que apetece leer y es a proposito: una condicion
 * improbable de la que depende un concepto atractivo es el trabajo real de la
 * etapa, y enterrarla al final de la lista seria esconderla.
 */
export function ConceptCard({
  concepto,
  dimensiones,
  numero,
  editable,
  resaltado,
  onResaltar,
}: {
  concepto: ConceptoVista;
  dimensiones: DimensionVista[];
  numero: number;
  editable: boolean;
  resaltado: boolean;
  onResaltar: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [verLienzo, setVerLienzo] = useState(false);
  const [verReglas, setVerReglas] = useState(false);
  const [nueva, setNueva] = useState("");
  const [nuevaKind, setNuevaKind] = useState<"CONDICION" | "PRECEDENTE">("CONDICION");

  const color = colorDeTrazo(concepto.color, concepto.position);
  const atr = promedioEje(concepto, "atractividad");
  const fit = promedioEje(concepto, "fit");
  const n = puntuados(concepto);
  const frase = fraseConectada(concepto);
  const piezasVacias = CONECTE_LOS_PUNTOS.filter((p) => !concepto[p.campo].trim());

  const condiciones = concepto.supuestos
    .filter((s) => s.kind === "CONDICION")
    .sort((a, b) => {
      if (a.critical !== b.critical) return a.critical ? -1 : 1;
      if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
      return a.likelihood - b.likelihood;
    });
  const precedentes = concepto.supuestos.filter((s) => s.kind === "PRECEDENTE");
  const criticas = condiciones.filter((s) => s.critical);
  const huerfanos = concepto.origenes.filter((o) => o.huerfano).length;

  // Un concepto completo recorre las cinco dimensiones del mapa con al menos un
  // fragmento vigente en cada una. Los anclados a fragmentos que ya no estan
  // aceptados no cuentan: la dimension quedo sin sostén aunque el texto siga.
  const anclasVivas = concepto.anclas.filter((a) => !a.huerfano);
  const faltantes = dimensiones.filter((d) => !anclasVivas.some((a) => a.rowId === d.id));
  const [verAnclas, setVerAnclas] = useState(false);

  const avisosII: string[] = [];
  if (condiciones.length > INGENIERIA_INVERSA.maxCondiciones) {
    avisosII.push(
      `${condiciones.length} condiciones: el ejercicio pide hasta ${INGENIERIA_INVERSA.maxCondiciones}. Consolida las que dependen de otra.`,
    );
  }
  if (condiciones.length > 0 && criticas.length !== INGENIERIA_INVERSA.menosProbables) {
    avisosII.push(
      `${criticas.length} marcada${criticas.length === 1 ? "" : "s"} como menos probable${criticas.length === 1 ? "" : "s"}: el ejercicio pide exactamente ${INGENIERIA_INVERSA.menosProbables}.`,
    );
  }
  const sinPrueba = criticas.filter((c) => !c.failFastTest || !c.expectedResult).length;
  if (sinPrueba > 0) {
    avisosII.push(
      `${sinPrueba} de las menos probables sin prueba de falla rápida o sin resultado esperado.`,
    );
  }

  function correr(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  const guardar = (campo: CampoConcepto, valor: string) => {
    if (valor === concepto[campo]) return;
    correr(() => updateConcept(concepto.id, { [campo]: valor }));
  };

  const cambiarSup = (s: SupuestoVista, cambios: Parameters<typeof updateAssumption>[1]) =>
    correr(() => updateAssumption(s.id, cambios));

  return (
    <article
      className="panel flex flex-col gap-4"
      style={{
        borderLeft: `3px solid ${color}`,
        boxShadow: resaltado ? `0 0 0 1px ${color}` : undefined,
      }}
    >
      {/* ── Cabecera ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onResaltar}
          className="grid h-[19px] w-[19px] flex-none place-items-center rounded-full font-mono text-[10px] font-bold text-[#12181B]"
          style={{ background: color }}
          title="Señalarlo en la matriz"
        >
          {numero}
        </button>

        {editable && (
          <label
            className="relative grid h-[18px] w-[18px] cursor-pointer place-items-center rounded-full transition hover:bg-[rgba(232,227,216,0.1)]"
            title="Color en la matriz"
          >
            <span
              className="block h-[11px] w-[11px] rounded-full ring-1 ring-[rgba(232,227,216,0.35)]"
              style={{ background: color }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => guardar("color", e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={`Color del concepto ${numero}`}
            />
          </label>
        )}

        {concepto.tipo && (
          <span
            className="rounded-[3px] border border-[rgba(111,191,178,0.35)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent"
            title={`${TIPOS_CONCEPTO[concepto.tipo].definicion} ${TIPOS_CONCEPTO[concepto.tipo].quien}`}
          >
            {TIPOS_CONCEPTO[concepto.tipo].label}
          </span>
        )}

        <span className="flex-1" />

        {atr !== null && fit !== null && (
          <span className="font-mono text-[10px] text-[#7d8a88] [font-variant-numeric:tabular-nums]">
            atr {atr.toFixed(1)} · fit {fit.toFixed(1)}
          </span>
        )}

        {editable && (
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="rounded-[3px] border border-[rgba(232,227,216,0.18)] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-[#8b9a97] transition hover:border-[rgba(111,191,178,0.5)] hover:text-accent"
          >
            {editando ? "listo" : "editar"}
          </button>
        )}
      </div>

      {/* ── Nombre, frase conectada y propuesta de valor (Ejercicio 1.1) ── */}
      {editable && editando ? (
        <div className="flex flex-col gap-2">
          <input
            defaultValue={concepto.title}
            onBlur={(e) => guardar("title", e.target.value)}
            placeholder="Nombre corto del concepto"
            className="field text-[15px] font-semibold"
          />
          <p className="kicker mt-1">Conecte los puntos · Ejercicio 1.1</p>
          <div className="flex flex-col gap-1.5">
            {CONECTE_LOS_PUNTOS.map((p) => (
              <label key={p.campo} className="flex items-baseline gap-2">
                <span className="w-[150px] flex-none text-right font-mono text-[10px] text-[#8b9a97]">
                  {p.antes}
                </span>
                <input
                  defaultValue={concepto[p.campo]}
                  onBlur={(e) => guardar(p.campo, e.target.value)}
                  placeholder={p.ayuda}
                  className="field flex-1 text-[12.5px]"
                />
              </label>
            ))}
          </div>
          <textarea
            defaultValue={concepto.propuestaValor}
            onBlur={(e) => guardar("propuestaValor", e.target.value)}
            rows={2}
            placeholder="Propuesta de valor, en una frase."
            className="field resize-y text-[12.5px]"
          />
          <textarea
            defaultValue={concepto.statement}
            onBlur={(e) => guardar("statement", e.target.value)}
            rows={2}
            placeholder="Que es, en una frase (si la frase conectada no basta)."
            className="field resize-y text-[12.5px]"
          />
          <textarea
            defaultValue={concepto.description}
            onBlur={(e) => guardar("description", e.target.value)}
            rows={3}
            placeholder="Desarrollo: como funcionaria, que hace falta."
            className="field resize-y text-[12px]"
          />
        </div>
      ) : (
        <div>
          <h3 className="text-[16px] font-semibold leading-snug text-[#e8e3d8]">
            {concepto.title}
          </h3>
          {frase ? (
            <p className="mt-1.5 max-w-[66ch] text-[13.5px] italic leading-relaxed text-[#cbd4d2]">
              {frase}
            </p>
          ) : (
            concepto.statement && (
              <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-[#a9b5b3]">
                {concepto.statement}
              </p>
            )
          )}
          {concepto.propuestaValor && (
            <p className="mt-2 text-[12.5px] leading-snug text-[#a9b5b3]">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-accent">
                Propuesta de valor ·{" "}
              </span>
              {concepto.propuestaValor}
            </p>
          )}
        </div>
      )}

      {/* ── Recorrido por el mapa ───────────────────────────────────────── */}
      {dimensiones.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerAnclas((v) => !v)}
            className="kicker mb-2 transition hover:text-accent"
          >
            Recorre el mapa · {dimensiones.length - faltantes.length} de {dimensiones.length}
          </button>
          <div className="flex flex-wrap gap-1.5">
            {dimensiones.map((d) => {
              const k = anclasVivas.filter((a) => a.rowId === d.id).length;
              return (
                <span
                  key={d.id}
                  className="rounded-[3px] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                  style={
                    k > 0
                      ? { background: `${d.color}33`, color: "#e8e3d8", border: `1px solid ${d.color}` }
                      : { color: "#5e7370", border: "1px dashed rgba(232,227,216,0.2)" }
                  }
                  title={k > 0 ? `${k} fragmento${k === 1 ? "" : "s"}` : "Sin fragmento que lo sostenga"}
                >
                  {d.name} {k > 0 ? `· ${k}` : ""}
                </span>
              );
            })}
          </div>
          {verAnclas && (
            <ul className="mt-3 flex flex-col gap-2">
              {dimensiones.map((d) => {
                const suyas = concepto.anclas.filter((a) => a.rowId === d.id);
                if (suyas.length === 0) return null;
                return (
                  <li key={d.id}>
                    <p className="font-mono text-[9.5px] uppercase tracking-wider" style={{ color: d.color }}>
                      {d.name}
                    </p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {suyas.map((a) => (
                        <li
                          key={a.id}
                          className={`text-[12px] leading-snug ${a.huerfano ? "text-[#c98b7a] line-through" : "text-[#a9b5b3]"}`}
                        >
                          {a.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── Lienzo del Ejercicio 1.1 ────────────────────────────────────── */}
      {dimensiones.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerLienzo((v) => !v)}
            className="kicker transition hover:text-accent"
          >
            {verLienzo ? "Ocultar el lienzo" : "Lienzo del concepto · cinco dimensiones"}
          </button>
          {verLienzo && (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {dimensiones.map((d) => {
                const vinetas = concepto.lienzo[d.id] ?? [];
                const guia = PREGUNTAS_ROBUSTAS[d.id];
                return (
                  <div
                    key={d.id}
                    className="rounded-[4px] border p-2.5"
                    style={{ borderColor: `${d.color}66` }}
                  >
                    <p className="font-mono text-[9.5px] uppercase tracking-wider" style={{ color: d.color }}>
                      {d.name}
                    </p>
                    {guia && (
                      <p className="mt-0.5 text-[10.5px] leading-snug text-[#7d8a88]" title={guia.preguntas.join("\n")}>
                        {guia.titulo}
                      </p>
                    )}
                    {editable ? (
                      <textarea
                        defaultValue={vinetas.join("\n")}
                        onBlur={(e) => {
                          const nuevas = e.target.value.split("\n");
                          if (nuevas.join("\n").trim() === vinetas.join("\n").trim()) return;
                          correr(() => updateLienzo(concepto.id, d.id, nuevas));
                        }}
                        rows={Math.max(3, vinetas.length + 1)}
                        placeholder={guia ? guia.preguntas.slice(0, 2).join(" ") : "Una viñeta por renglón."}
                        className="field mt-1.5 w-full resize-y text-[12px]"
                      />
                    ) : vinetas.length > 0 ? (
                      <ul className="mt-1.5 list-disc pl-4 text-[12px] leading-snug text-[#cbd4d2]">
                        {vinetas.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-[11.5px] text-[#5e7370]">Sin viñetas.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Avisos ─────────────────────────────────────────────────────── */}
      {(n < SUBCRITERIOS.length || huerfanos > 0 || faltantes.length > 0 || piezasVacias.length > 0) && (
        <ul className="flex flex-col gap-1 rounded-[4px] border border-dashed border-[rgba(201,162,39,0.4)] p-2.5">
          {piezasVacias.length > 0 && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              Frase incompleta: falta «{piezasVacias.map((p) => p.antes).join("», «")}». La frase del
              Ejercicio 1.1 une las cinco dimensiones en una sola oración.
            </li>
          )}
          {n < SUBCRITERIOS.length && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              {n} de {SUBCRITERIOS.length} criterios puntuados. Su sitio en la matriz puede
              moverse con los que faltan.
            </li>
          )}
          {faltantes.length > 0 && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              Concepto incompleto: no recorre {faltantes.map((d) => d.name.toLowerCase()).join(", ")}. Un
              concepto de negocio se apoya en al menos un fragmento del mapa en cada una de las cinco
              dimensiones.
            </li>
          )}
          {huerfanos > 0 && (
            <li className="text-[11.5px] leading-snug text-[#c9a94e]">
              {huerfanos} idea{huerfanos === 1 ? "" : "s"} de origen ya no existe en Combinar.
              El texto se conserva, pero conviene revisarlo.
            </li>
          )}
        </ul>
      )}

      {/* ── Priorizacion (Ejercicio 2) ─────────────────────────────────── */}
      <div>
        <p className="kicker mb-2">Priorización · atractividad y fit</p>
        <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
          {(["atractividad", "fit"] as const).map((eje) => (
            <div key={eje} className="flex flex-col gap-1.5">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5e7370]">
                {eje}
              </span>
              {SUBCRITERIOS.filter((s) => s.eje === eje).map((s) => (
                <div key={s.campo} className="flex items-center gap-2" title={s.ayuda}>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#a9b5b3]">
                    {s.label}
                  </span>
                  <span className="flex flex-none gap-[3px]">
                    {[1, 2, 3, 4, 5].map((v) => {
                      const puesto = concepto[s.campo] >= v;
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={!editable || pending}
                          // Volver a pulsar el valor actual lo despuntua: es la
                          // unica forma de decir "aun no lo hemos mirado".
                          onClick={() =>
                            correr(() =>
                              scoreConcept(concepto.id, s.campo, concepto[s.campo] === v ? 0 : v),
                            )
                          }
                          title={`${s.label}: ${v} de 5 — ${s.ayuda}`}
                          aria-label={`${s.label}, ${v} de 5`}
                          className="grid h-[15px] w-[13px] place-items-center disabled:cursor-default"
                        >
                          <span
                            className="block h-[11px] w-[6px] rounded-[1px] transition-all"
                            style={{ background: puesto ? color : "rgba(232,227,216,0.14)" }}
                          />
                        </button>
                      );
                    })}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Ingenieria inversa ─────────────────────────────────────────── */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
          <p className="kicker">Ingeniería inversa · {condiciones.length} condiciones</p>
          <button
            type="button"
            onClick={() => setVerReglas((v) => !v)}
            className="font-mono text-[9px] uppercase tracking-wider text-[#5e7370] hover:text-accent"
          >
            {verReglas ? "ocultar reglas" : "reglas"}
          </button>
        </div>
        <p className="mb-2 text-[11.5px] leading-snug text-[#7d8a88]">{INGENIERIA_INVERSA.pregunta}</p>

        {verReglas && (
          <ul className="mb-3 flex list-disc flex-col gap-1 pl-4 text-[11px] leading-snug text-[#8b9a97]">
            {INGENIERIA_INVERSA.reglas.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        {avisosII.length > 0 && (
          <ul className="mb-2 flex flex-col gap-1 rounded-[4px] border border-dashed border-[rgba(201,162,39,0.4)] p-2">
            {avisosII.map((a) => (
              <li key={a} className="text-[11px] leading-snug text-[#c9a94e]">
                {a}
              </li>
            ))}
          </ul>
        )}

        <ul className="flex flex-col gap-1.5">
          {condiciones.map((s) => (
            <FilaCondicion
              key={s.id}
              s={s}
              editable={editable}
              pending={pending}
              onCambiar={(c) => cambiarSup(s, c)}
              onPreguntar={(quien) => correr(() => assumptionToQuestion(s.id, quien))}
              onEliminar={() => correr(() => deleteAssumption(s.id))}
            />
          ))}
        </ul>

        {/* Las tres condiciones mas importantes (lamina 27) */}
        {criticas.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-[4px] border border-[rgba(232,227,216,0.12)]">
            <table className="w-full min-w-[520px] border-collapse text-[11.5px]">
              <thead>
                <tr className="bg-[rgba(111,191,178,0.1)] text-left">
                  {INGENIERIA_INVERSA.columnas.map((c) => (
                    <th key={c} className="px-2 py-1.5 align-top font-normal text-[10.5px] leading-snug text-[#a9b5b3]">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criticas.map((s, i) => (
                  <tr key={s.id} className="border-t border-[rgba(232,227,216,0.08)] align-top">
                    <td className="px-2 py-1.5 text-[#e8e3d8]">
                      {i + 1}. {s.text}
                    </td>
                    <td className="px-2 py-1.5">
                      {editable ? (
                        <textarea
                          defaultValue={s.failFastTest}
                          onBlur={(e) => e.target.value.trim() !== s.failFastTest && cambiarSup(s, { failFastTest: e.target.value })}
                          rows={2}
                          placeholder={INGENIERIA_INVERSA.ejemplo.prueba}
                          className="field w-full resize-y text-[11.5px]"
                        />
                      ) : (
                        <span className="text-[#cbd4d2]">{s.failFastTest || "—"}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {editable ? (
                        <textarea
                          defaultValue={s.expectedResult}
                          onBlur={(e) => e.target.value.trim() !== s.expectedResult && cambiarSup(s, { expectedResult: e.target.value })}
                          rows={2}
                          placeholder={INGENIERIA_INVERSA.ejemplo.resultado}
                          className="field w-full resize-y text-[11.5px]"
                        />
                      ) : (
                        <span className="text-[#cbd4d2]">{s.expectedResult || "—"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Precedentes: lo que ya se dio por sentado */}
        {precedentes.length > 0 && (
          <div className="mt-3">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5e7370]">
              Se dan por sentado · {precedentes.length}
            </p>
            <ul className="mt-1 flex flex-col gap-1">
              {precedentes.map((s) => (
                <li key={s.id} className="group flex items-start gap-2 text-[12px] leading-snug text-[#8b9a97]">
                  <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-[#5e7370]" />
                  <span className="min-w-0 flex-1">{s.text}</span>
                  {editable && (
                    <span className="flex flex-none gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => cambiarSup(s, { kind: "CONDICION" })}
                        className="px-1 font-mono text-[9px] uppercase text-[#5e7370] hover:text-accent"
                        title="Volverlo condición"
                      >
                        condición
                      </button>
                      <button
                        type="button"
                        onClick={() => correr(() => deleteAssumption(s.id))}
                        className="px-1 text-[13px] leading-none text-[#5e7370] hover:text-[#c98b7a]"
                        title="Eliminar"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {editable && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = nueva.trim();
              if (!t) return;
              setNueva("");
              correr(() => addAssumption(concepto.id, t, 3, nuevaKind));
            }}
            className="mt-2 flex gap-2"
          >
            <select
              value={nuevaKind}
              onChange={(e) => setNuevaKind(e.target.value as "CONDICION" | "PRECEDENTE")}
              className="rounded-[3px] border border-[rgba(232,227,216,0.18)] bg-[#1b2225] px-1 font-mono text-[9.5px] uppercase text-[#a9b5b3] outline-none"
              title="Condición: tiene que llegar a existir. Precedente: ya se dio por sentado."
            >
              <option value="CONDICION">Condición</option>
              <option value="PRECEDENTE">Precedente</option>
            </select>
            <input
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              placeholder={
                nuevaKind === "CONDICION"
                  ? "Para que el concepto se ejecute, tiene que llegar a existir…"
                  : "Ya damos por sentado que…"
              }
              className="field flex-1 text-[12.5px]"
            />
            <button type="submit" className="btn" disabled={pending || !nueva.trim()}>
              Añadir
            </button>
          </form>
        )}
      </div>

      {/* ── Origen y desarrollo ────────────────────────────────────────── */}
      <div>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="kicker transition hover:text-accent"
        >
          {abierto ? "Ocultar el origen" : `Ver de donde sale (${concepto.origenes.length})`}
        </button>

        {abierto && (
          <div className="mt-3 flex flex-col gap-3">
            {concepto.description && !editando && (
              <p className="max-w-[62ch] whitespace-pre-line text-[12.5px] leading-relaxed text-[#a9b5b3]">
                {concepto.description}
              </p>
            )}
            <ul className="flex flex-col gap-1.5">
              {concepto.origenes.map((o) => (
                <li key={o.id} className="group flex items-start gap-2">
                  <span
                    className="mt-[5px] h-2 w-2 flex-none rounded-full"
                    style={{ background: o.huerfano ? "#8E3324" : "#5e7370" }}
                  />
                  <p
                    className={`min-w-0 flex-1 text-[12px] leading-snug ${
                      o.huerfano ? "text-[#c98b7a] line-through" : "text-[#a9b5b3]"
                    }`}
                  >
                    {o.textSnapshot}
                    {o.huerfano && (
                      <span className="ml-1 font-mono text-[9px] uppercase">· idea eliminada</span>
                    )}
                  </p>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => correr(() => removeConceptSource(o.id))}
                      className="flex-none px-1 text-[13px] leading-none text-[#5e7370] opacity-0 transition hover:text-[#c98b7a] group-hover:opacity-100"
                      title="Desconectar esta idea"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
              {concepto.origenes.length === 0 && (
                <li className="text-[11.5px] text-[#5e7370]">
                  Sin ideas de origen. Se puede conectar alguna desde el panel de arriba.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}

      {editable && (
        <div className="border-t border-[rgba(232,227,216,0.1)] pt-3">
          <Eliminar onConfirm={() => correr(() => deleteConcept(concepto.id))} />
        </div>
      )}
    </article>
  );
}

/** Una condicion de la ingenieria inversa: estrella, detonante, probabilidad, estado. */
function FilaCondicion({
  s,
  editable,
  pending,
  onCambiar,
  onPreguntar,
  onEliminar,
}: {
  s: SupuestoVista;
  editable: boolean;
  pending: boolean;
  onCambiar: (c: Parameters<typeof updateAssumption>[1]) => void;
  onPreguntar: (quien: string) => void;
  onEliminar: () => void;
}) {
  const meta = ASSUMPTION_STATUS_META[s.status as AssumptionStatus];
  const prob = PROBABILIDAD.find((p) => p.n === s.likelihood)!;
  const det = DETONANTES.find((d) => d.key === s.trigger);

  return (
    <li className="group flex items-start gap-2">
      <button
        type="button"
        disabled={!editable || pending}
        onClick={() => onCambiar({ critical: !s.critical })}
        className="mt-[1px] flex-none text-[13px] leading-none disabled:cursor-default"
        style={{ color: s.critical ? "#e0a458" : "rgba(232,227,216,0.2)" }}
        title={s.critical ? "Una de las tres menos probables" : "Marcarla como una de las tres menos probables"}
        aria-label={s.critical ? "Quitar de las menos probables" : "Marcar como menos probable"}
      >
        ★
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`text-[12.5px] leading-snug ${
            s.status === "REFUTED" ? "text-[#7d8a88] line-through" : "text-[#cbd4d2]"
          }`}
        >
          {s.text}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 font-mono text-[9px] uppercase tracking-[0.07em] text-[#5e7370]">
          {det && (
            <span className="rounded-[2px] px-1 text-[#e8e3d8]" style={{ background: `${det.color}cc` }}>
              {det.label}
            </span>
          )}
          <span style={{ color: s.status === "OPEN" ? prob.color : meta.color }}>
            {s.status === "OPEN" ? prob.label : meta.label}
          </span>
          {s.questionId && <span>· en el banco de preguntas</span>}
        </p>
        {s.note && <p className="mt-0.5 text-[11px] leading-snug text-[#8b9a97]">{s.note}</p>}
      </div>

      {editable && (
        <span className="flex flex-none items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <select
            value={s.trigger}
            onChange={(e) => onCambiar({ trigger: e.target.value })}
            title="Detonante"
            className="max-w-[92px] rounded-[3px] border border-[rgba(232,227,216,0.18)] bg-[#1b2225] px-1 py-0.5 font-mono text-[9px] text-[#a9b5b3] outline-none"
          >
            <option value="">detonante…</option>
            {DETONANTES.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            value={s.likelihood}
            onChange={(e) => onCambiar({ likelihood: Number(e.target.value) })}
            title="Que tan probable es"
            className="rounded-[3px] border border-[rgba(232,227,216,0.18)] bg-[#1b2225] px-1 py-0.5 font-mono text-[9px] text-[#a9b5b3] outline-none"
          >
            {PROBABILIDAD.map((p) => (
              <option key={p.n} value={p.n}>
                {p.n}
              </option>
            ))}
          </select>
          <select
            value={s.status}
            onChange={(e) => onCambiar({ status: e.target.value })}
            title="Estado"
            className="rounded-[3px] border border-[rgba(232,227,216,0.18)] bg-[#1b2225] px-1 py-0.5 font-mono text-[9px] uppercase text-[#a9b5b3] outline-none"
          >
            {(Object.keys(ASSUMPTION_STATUS_META) as AssumptionStatus[]).map((k) => (
              <option key={k} value={k}>
                {ASSUMPTION_STATUS_META[k].label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onCambiar({ kind: "PRECEDENTE" })}
            className="px-1 font-mono text-[9px] uppercase text-[#5e7370] hover:text-accent"
            title="Ya se dio por sentado: moverla a precedentes"
          >
            precedente
          </button>
          {!s.questionId && (
            <button
              type="button"
              onClick={() => {
                const quien = window.prompt(
                  "¿Quien resuelve esta pregunta? (sponsor, equipo, asesor…)",
                  "Equipo",
                );
                if (quien !== null) onPreguntar(quien);
              }}
              title="Mandarla al banco de preguntas"
              className="px-1 font-mono text-[9px] uppercase text-[#5e7370] hover:text-accent"
            >
              preguntar
            </button>
          )}
          <button
            type="button"
            onClick={onEliminar}
            className="px-1 text-[13px] leading-none text-[#5e7370] hover:text-[#c98b7a]"
            title="Eliminar (por ejemplo, al consolidarla con otra)"
          >
            ×
          </button>
        </span>
      )}
    </li>
  );
}

function Eliminar({ onConfirm }: { onConfirm: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  return confirmando ? (
    <span className="flex gap-2">
      <button type="button" className="btn btn-danger" onClick={onConfirm}>
        Si, eliminar
      </button>
      <button type="button" className="btn" onClick={() => setConfirmando(false)}>
        Cancelar
      </button>
    </span>
  ) : (
    <button type="button" className="btn" onClick={() => setConfirmando(true)}>
      Eliminar concepto
    </button>
  );
}
