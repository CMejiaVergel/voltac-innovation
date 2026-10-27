"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DETONANTES, LINEA_CONCEPTO } from "@/lib/gimi";
import { CAMPOS_BROCHURE, CAMPOS_CASO, type DatosActuar, type PasoLinea } from "@/lib/actuar";
import {
  ARTIFACT_KINDS,
  ARTIFACT_KIND_LABEL,
  ARTIFACT_STATUSES,
  ARTIFACT_STATUS_META,
  ASSUMPTION_STATUSES,
  ASSUMPTION_STATUS_META,
  colorDeTrazo,
  type ArtifactKind,
  type ArtifactStatus,
  type AssumptionStatus,
} from "@/lib/enums";
import {
  actualizarArtefacto,
  actualizarSupuesto,
  agregarSupuesto,
  borrarArtefacto,
  borrarSupuesto,
  crearArtefacto,
  guardarPaso,
  guardarPropuesta,
} from "@/app/actions/actuar";

export type ConceptoLinea = {
  id: string;
  title: string;
  statement: string;
  color: string;
  propuestaValor: string;
  datos: DatosActuar;
  artefactos: { id: string; title: string; kind: ArtifactKind; promise: string; status: ArtifactStatus; iteration: number; presentedTo: string }[];
  supuestos: { id: string; text: string; likelihood: number; critical: boolean; failFastTest: string; expectedResult: string; trigger: string; status: AssumptionStatus }[];
  avance: Record<PasoLinea, boolean>;
};

type Accion = () => Promise<{ ok: boolean; error?: string }>;

/**
 * Actuar: la línea recta de cada concepto priorizado (mentor, 15-oct-2026).
 * Mismos pasos para todos, uno detrás de otro; cada uno en una pantalla.
 */
export function LineaConcepto({ slug, conceptos, editable }: { slug: string; conceptos: ConceptoLinea[]; editable: boolean }) {
  const router = useRouter();
  const [activoId, setActivoId] = useState(conceptos[0]?.id ?? null);
  const activo = conceptos.find((c) => c.id === activoId) ?? conceptos[0] ?? null;
  const primeroPendiente = (c: ConceptoLinea) => LINEA_CONCEPTO.find((p) => !c.avance[p.key])?.key ?? "caso";
  const [paso, setPaso] = useState<PasoLinea>(activo ? primeroPendiente(activo) : "brochure");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, start] = useTransition();

  useEffect(() => {
    if (activo) setPaso(primeroPendiente(activo));
    // Solo al cambiar de concepto: al guardar, la persona sigue en el paso donde está.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo?.id]);

  function correr(accion: Accion, despues?: () => void) {
    setError(null);
    start(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error ?? "No se pudo guardar.");
      else despues?.();
      router.refresh();
    });
  }

  if (!activo) {
    return (
      <div className="panel py-10">
        <p className="text-[16px] font-semibold text-[#e8e3d8]">Aún no hay un concepto que siga adelante</p>
        <p className="hint mt-1">En Convergir, el equipo marca cuál o cuáles siguen.</p>
        <Link href={`/proyectos/${slug}/convergir`} className="btn btn-primary mt-4 inline-block">
          Ir a priorizar →
        </Link>
      </div>
    );
  }

  const i = LINEA_CONCEPTO.findIndex((p) => p.key === paso);
  const siguiente = LINEA_CONCEPTO[i + 1];
  const props = { c: activo, editable, pendiente, correr };

  return (
    <div className="flex flex-col gap-5">
      {conceptos.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {conceptos.map((c, k) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActivoId(c.id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] ${
                c.id === activo.id ? "border-accent bg-[rgba(111,191,178,0.14)] text-accent" : "border-[rgba(232,227,216,0.16)] text-[#a9b5b3]"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorDeTrazo(c.color, k) }} />
              {c.title}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-bold leading-tight text-[#e8e3d8]">{activo.title}</h2>
          {activo.statement && <p className="mt-1 max-w-[90ch] text-[13px] leading-relaxed text-[#a9b5b3]">{activo.statement}</p>}
        </div>
        <a href={`/api/proyectos/${slug}/pptx?concepto=${activo.id}`} className="btn shrink-0">
          Descargar PPTX
        </a>
      </div>

      {/* La línea recta */}
      <ol className="flex items-center">
        {LINEA_CONCEPTO.map((p, k) => {
          const hecho = activo.avance[p.key];
          const actual = p.key === paso;
          return (
            <li key={p.key} className={`flex items-center ${actual ? "flex-1" : "md:flex-1"}`}>
              <button
                type="button"
                onClick={() => setPaso(p.key)}
                aria-current={actual ? "step" : undefined}
                className={`flex flex-1 items-center gap-2 rounded-[4px] px-1.5 py-2 text-left md:px-2.5 ${actual ? "bg-[rgba(111,191,178,0.12)]" : "hover:bg-[rgba(232,227,216,0.04)]"}`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                    hecho ? "bg-accent text-accentDeep" : actual ? "border-2 border-accent text-accent" : "border border-[#4d5a58] text-[#7f8f8c]"
                  }`}
                >
                  {hecho ? "✓" : k + 1}
                </span>
                <span className={`text-[13px] font-semibold leading-tight ${actual ? "text-accent" : "text-[#c0ccca]"} ${actual ? "" : "hidden md:inline"}`}>
                  {p.nombre}
                </span>
              </button>
              {k < LINEA_CONCEPTO.length - 1 && <span className={`mx-1 h-px w-3 shrink-0 md:w-5 ${hecho ? "bg-accent" : "bg-[#3a4745]"}`} />}
            </li>
          );
        })}
      </ol>

      {error && <p className="rounded-[4px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] p-3 text-[12.5px] text-[#e8a99c]">{error}</p>}

      {paso === "brochure" && <PasoBrochure key={activo.id} {...props} />}
      {paso === "artefacto" && <PasoArtefacto key={activo.id} {...props} />}
      {paso === "ingenieria" && <PasoIngenieria key={activo.id} {...props} />}
      {paso === "propuesta" && <PasoPropuesta key={activo.id} {...props} />}
      {paso === "caso" && <PasoCaso key={activo.id} {...props} />}

      {siguiente && (
        <div className="border-t border-[rgba(232,227,216,0.1)] pt-4">
          <button type="button" onClick={() => setPaso(siguiente.key)} className="btn">
            Siguiente: {siguiente.nombre} →
          </button>
        </div>
      )}
    </div>
  );
}

type PasoProps = { c: ConceptoLinea; editable: boolean; pendiente: boolean; correr: (a: Accion, despues?: () => void) => void };

function useGuardado() {
  const [guardado, setGuardado] = useState(false);
  return { guardado, marcar: () => setGuardado(true), limpiar: () => setGuardado(false) };
}

function BotonGuardar({ pendiente, guardado, onClick }: { pendiente: boolean; guardado: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className="btn btn-primary" disabled={pendiente} onClick={onClick}>
        {pendiente ? "Guardando…" : "Guardar"}
      </button>
      {guardado && <span className="text-[12px] text-accent">Guardado</span>}
    </div>
  );
}

// ─── 1. Brochure ─────────────────────────────────────────────────────────────

function PasoBrochure({ c, editable, pendiente, correr }: PasoProps) {
  const [d, setD] = useState<Record<string, string>>({ ...c.datos.brochure });
  const g = useGuardado();
  const set = (k: string, v: string) => {
    setD({ ...d, [k]: v });
    g.limpiar();
  };
  const beneficios = (d.beneficios ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="panel flex flex-col gap-4">
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          {CAMPOS_BROCHURE.map((f) => (
            <label key={f.campo} className="block">
              <span className="label">{f.label}</span>
              {f.filas === 1 ? (
                <input value={d[f.campo] ?? ""} onChange={(e) => set(f.campo, e.target.value)} placeholder={f.placeholder} className="field" />
              ) : (
                <textarea value={d[f.campo] ?? ""} onChange={(e) => set(f.campo, e.target.value)} rows={f.filas} placeholder={f.placeholder} className="field resize-y leading-relaxed" />
              )}
            </label>
          ))}
        </fieldset>
        {editable && <BotonGuardar pendiente={pendiente} guardado={g.guardado} onClick={() => correr(() => guardarPaso(c.id, "brochure", d), g.marcar)} />}
      </div>

      {/* Vista previa: así lo leería el cliente */}
      <div className="rounded-[6px] bg-[#f4ecd6] p-6 text-[#1d2224] shadow-[0_6px_24px_rgba(0,0,0,0.35)] lg:sticky lg:top-[72px] lg:self-start">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6b7c7a]">{c.title}</p>
        <h3 className="mt-2 text-[22px] font-bold leading-tight">{d.titular || "Titular del brochure"}</h3>
        {d.problema && <p className="mt-4 text-[13px] leading-relaxed text-[#3b4446]">{d.problema}</p>}
        {d.solucion && (
          <div className="mt-4 rounded-[4px] bg-white/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2F7D5F]">La solución</p>
            <p className="mt-1 text-[13.5px] leading-relaxed">{d.solucion}</p>
          </div>
        )}
        {beneficios.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-[13px]">
            {beneficios.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-[#2F7D5F]">✓</span>
                {b}
              </li>
            ))}
          </ul>
        )}
        {d.llamado && <p className="mt-5 inline-block rounded-full bg-[#1d2224] px-4 py-2 text-[12.5px] font-semibold text-[#f4ecd6]">{d.llamado}</p>}
      </div>
    </div>
  );
}

// ─── 2. Artefacto ────────────────────────────────────────────────────────────

const TIPOS_ARTEFACTO = ARTIFACT_KINDS.filter((k) => k !== "BROCHURE");

function PasoArtefacto({ c, editable, pendiente, correr }: PasoProps) {
  const [nuevo, setNuevo] = useState({ title: "", kind: "PROTOCEPTO", promise: "" });

  return (
    <div className="flex flex-col gap-3">
      <p className="hint">Lo que se le muestra a la empresa para probar el concepto. Cada vuelta con el mercado es una iteración.</p>
      {c.artefactos.map((a) => (
        <article key={a.id} className="panel flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-[15px] font-semibold text-[#e8e3d8]">{a.title}</h3>
            <span className="text-[12px] text-[#7f8f8c]">{ARTIFACT_KIND_LABEL[a.kind]}</span>
            <span className="flex-1" />
            <span className="font-mono text-[11px] text-[#8b9a97]">Iteración {a.iteration}</span>
          </div>
          {a.promise && <p className="text-[13px] text-[#c0ccca]">«{a.promise}»</p>}
          {editable && (
            <div className="flex flex-wrap items-center gap-1.5">
              {ARTIFACT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pendiente}
                  onClick={() => correr(() => actualizarArtefacto(a.id, { status: s }))}
                  className="rounded-full border px-3 py-1 text-[12px]"
                  style={
                    a.status === s
                      ? { borderColor: ARTIFACT_STATUS_META[s].color, background: `${ARTIFACT_STATUS_META[s].color}33`, color: "#e8e3d8" }
                      : { borderColor: "rgba(232,227,216,0.16)", color: "#8b9a97" }
                  }
                >
                  {ARTIFACT_STATUS_META[s].label}
                </button>
              ))}
              <span className="flex-1" />
              <button type="button" className="btn" disabled={pendiente} onClick={() => correr(() => actualizarArtefacto(a.id, { otraIteracion: true }))}>
                + Otra iteración
              </button>
              <button
                type="button"
                className="text-[12px] text-[#7f8f8c] hover:text-[#e8a99c]"
                onClick={() => confirm(`¿Borrar «${a.title}»?`) && correr(() => borrarArtefacto(a.id))}
              >
                Borrar
              </button>
            </div>
          )}
          {a.status === "PRESENTADO" && (
            <input
              defaultValue={a.presentedTo}
              disabled={!editable}
              onBlur={(e) => e.target.value !== a.presentedTo && correr(() => actualizarArtefacto(a.id, { presentedTo: e.target.value }))}
              placeholder="¿A quién se le presentó y qué dijo?"
              className="field"
            />
          )}
        </article>
      ))}

      {editable && (
        <div className="panel flex flex-col gap-3">
          <h3 className="text-[14px] font-semibold text-[#e8e3d8]">Nuevo artefacto</h3>
          <div className="grid gap-3 md:grid-cols-[1fr_200px]">
            <input value={nuevo.title} onChange={(e) => setNuevo({ ...nuevo, title: e.target.value })} placeholder="Nombre, ej. Protocepto del tablero de control" className="field" />
            <select value={nuevo.kind} onChange={(e) => setNuevo({ ...nuevo, kind: e.target.value })} className="field">
              {TIPOS_ARTEFACTO.map((k) => (
                <option key={k} value={k}>
                  {ARTIFACT_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <input value={nuevo.promise} onChange={(e) => setNuevo({ ...nuevo, promise: e.target.value })} placeholder="Lo que la empresa tiene que entender al verlo, en una frase" className="field" />
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pendiente || !nuevo.title.trim()}
              onClick={() => correr(() => crearArtefacto(c.id, nuevo), () => setNuevo({ title: "", kind: nuevo.kind, promise: "" }))}
            >
              Agregar artefacto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 3. Ingeniería inversa ───────────────────────────────────────────────────

function PasoIngenieria({ c, editable, pendiente, correr }: PasoProps) {
  const [texto, setTexto] = useState("");
  const orden = [...c.supuestos].sort((a, b) => Number(b.critical) - Number(a.critical) || a.likelihood - b.likelihood);
  const criticos = c.supuestos.filter((s) => s.critical).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="hint">
        ¿Qué debe ser una realidad para que el concepto sea un éxito en la organización? Listen todas las condiciones, marquen las 3 menos probables ({criticos} de 3) y
        definan para cada una una prueba de falla rápida y el resultado o la decisión que esperan.
      </p>
      <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-[#7f8f8c]">
        Piensen en:
        {DETONANTES.map((d) => (
          <span key={d.key} className="rounded-full border px-2 py-0.5" style={{ borderColor: `${d.color}88`, color: "#c9d1cf" }}>
            {d.label}
          </span>
        ))}
      </p>
      {orden.map((s) => (
        <article key={s.id} className="panel flex flex-col gap-3" style={s.critical ? { borderColor: "#E8C66A" } : undefined}>
          <div className="flex items-start gap-3">
            <button
              type="button"
              disabled={!editable || pendiente}
              onClick={() => correr(() => actualizarSupuesto(s.id, { critical: !s.critical }))}
              className={`mt-0.5 text-[18px] leading-none ${s.critical ? "text-[#E8C66A]" : "text-[#4d5a58] hover:text-[#E8C66A]"}`}
              title={s.critical ? "Es de las menos probables" : "Marcar como de las menos probables"}
              aria-label="Crítico"
            >
              ★
            </button>
            <p className="flex-1 text-[13.5px] leading-relaxed text-[#e8e3d8]">{s.text}</p>
            <select
              value={s.trigger}
              disabled={!editable}
              onChange={(e) => correr(() => actualizarSupuesto(s.id, { trigger: e.target.value }))}
              className="rounded-[3px] border border-[rgba(232,227,216,0.16)] bg-transparent px-1 py-0.5 text-[11.5px] text-[#a9b5b3]"
              aria-label="Detonante"
            >
              <option value="">Detonante…</option>
              {DETONANTES.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </select>
            {editable && (
              <button type="button" onClick={() => confirm("¿Borrar este supuesto?") && correr(() => borrarSupuesto(s.id))} className="text-[12px] text-[#7f8f8c] hover:text-[#e8a99c]">
                Borrar
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8">
            <span className="flex items-center gap-1.5 text-[12px] text-[#8b9a97]">
              ¿Qué tan probable?
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={!editable || pendiente}
                  onClick={() => correr(() => actualizarSupuesto(s.id, { likelihood: v }))}
                  className={`h-7 w-7 rounded-[4px] border text-[12px] ${s.likelihood === v ? "border-accent bg-[rgba(111,191,178,0.25)] text-[#e8e3d8]" : "border-[rgba(232,227,216,0.14)] text-[#7f8f8c]"}`}
                >
                  {v}
                </button>
              ))}
            </span>
            <select
              value={s.status}
              disabled={!editable}
              onChange={(e) => correr(() => actualizarSupuesto(s.id, { status: e.target.value }))}
              className="field w-auto py-1 text-[12px]"
              style={{ color: ASSUMPTION_STATUS_META[s.status].color }}
            >
              {ASSUMPTION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {ASSUMPTION_STATUS_META[st].label}
                </option>
              ))}
            </select>
          </div>
          {s.critical && (
            <div className="pl-8">
              <textarea
                defaultValue={s.failFastTest}
                disabled={!editable}
                rows={2}
                onBlur={(e) => e.target.value !== s.failFastTest && correr(() => actualizarSupuesto(s.id, { failFastTest: e.target.value }))}
                placeholder="Prueba de falla rápida o experimento crítico. Ej.: hablar con 3 plantas vecinas"
                className="field resize-y text-[12.5px] leading-relaxed"
              />
              <textarea
                defaultValue={s.expectedResult}
                disabled={!editable}
                rows={2}
                onBlur={(e) => e.target.value !== s.expectedResult && correr(() => actualizarSupuesto(s.id, { expectedResult: e.target.value }))}
                placeholder="Resultado deseado o decisión. Ej.: carta de intención de al menos 1"
                className="field mt-2 resize-y text-[12.5px] leading-relaxed"
              />
            </div>
          )}
        </article>
      ))}
      {editable && (
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && texto.trim() && correr(() => agregarSupuesto(c.id, texto), () => setTexto(""))}
            placeholder="Ej. La planta vecina acepta vendernos su agua de rechazo"
            className="field flex-1"
          />
          <button type="button" className="btn btn-primary" disabled={pendiente || !texto.trim()} onClick={() => correr(() => agregarSupuesto(c.id, texto), () => setTexto(""))}>
            Agregar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 4. Propuesta de valor ───────────────────────────────────────────────────

function PasoPropuesta({ c, editable, pendiente, correr }: PasoProps) {
  const [texto, setTexto] = useState(c.propuestaValor);
  const g = useGuardado();
  return (
    <div className="panel flex flex-col gap-4">
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          g.limpiar();
        }}
        disabled={!editable}
        rows={5}
        placeholder="Para [cliente] que [necesidad], [nombre del concepto] es [qué es] que [beneficio principal]. A diferencia de [la alternativa de hoy], [lo que nos hace distintos]."
        className="field resize-y text-[14px] leading-relaxed"
      />
      {editable && <BotonGuardar pendiente={pendiente} guardado={g.guardado} onClick={() => correr(() => guardarPropuesta(c.id, texto), g.marcar)} />}
    </div>
  );
}

// ─── 5. Caso de negocio ──────────────────────────────────────────────────────

function PasoCaso({ c, editable, pendiente, correr }: PasoProps) {
  const [d, setD] = useState<Record<string, string>>({ ...c.datos.caso });
  const g = useGuardado();
  return (
    <div className="panel flex flex-col gap-4">
      <fieldset disabled={!editable} className="grid gap-4 md:grid-cols-2">
        {CAMPOS_CASO.map((f) => (
          <label key={f.campo} className="block">
            <span className="label">{f.label}</span>
            <textarea
              value={d[f.campo] ?? ""}
              onChange={(e) => {
                setD({ ...d, [f.campo]: e.target.value });
                g.limpiar();
              }}
              rows={3}
              placeholder={f.placeholder}
              className="field resize-y leading-relaxed"
            />
          </label>
        ))}
      </fieldset>
      {editable && <BotonGuardar pendiente={pendiente} guardado={g.guardado} onClick={() => correr(() => guardarPaso(c.id, "caso", d), g.marcar)} />}
    </div>
  );
}
