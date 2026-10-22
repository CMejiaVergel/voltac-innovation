import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrg, leerJson } from "@/lib/organizaciones";
import { canEdit } from "@/lib/enums";
import { AUTOEVALUACION_DESAFIO, PASOS_CONFIGURAR, TIPOS_INNOVACION } from "@/lib/gimi";
import { ENCAJE_VACIO, resumirEncaje, VEREDICTO_META, type Encaje } from "@/lib/encaje";
import { proponerDesafio, evaluarEncaje, eliminarDesafio } from "@/app/actions/organizaciones";
import { Avisos, Bloque, Campo, DecideElEquipo } from "@/components/v2/ui";

function SiNo({ name, valor, label }: { name: string; valor: boolean | null | undefined; label: string }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-3 text-[12.5px] text-[#a9b5b3]">
      <legend className="sr-only">{label}</legend>
      <span className="min-w-0 flex-1">{label}</span>
      {[
        ["si", "Sí", valor === true],
        ["no", "No", valor === false],
        ["", "Sin evaluar", valor === null || valor === undefined],
      ].map(([v, t, c]) => (
        <label key={String(v)} className="flex items-center gap-1.5">
          <input type="radio" name={name} value={String(v)} defaultChecked={Boolean(c)} className="accent-[#6FBFB2]" />
          {t}
        </label>
      ))}
    </fieldset>
  );
}

export default async function DesafiosPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ hecho?: string; error?: string }>;
}) {
  const { org: slug } = await params;
  const { hecho, error } = await searchParams;
  const user = await requireUser();
  const { org, role } = await requireOrg(user, slug);
  const editable = canEdit(role);
  const paso = PASOS_CONFIGURAR[1];

  const tiposOrg = leerJson<string[]>(org.perfil?.tiposInnovacion, []);
  const restriccionesOrg = leerJson<string[]>(org.perfil?.restricciones, []);
  const desafios = await prisma.desafioPropuesto.findMany({
    where: { organizacionId: org.id },
    orderBy: { createdAt: "asc" },
    include: { autor: { select: { name: true } } },
  });

  return (
    <div className="mt-8 max-w-[960px]">
      <Avisos hecho={hecho} error={error} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="kicker">Paso 2 · {paso.nombre} · ejercicio 2.1.1</p>
        <DecideElEquipo />
      </div>
      <p className="hint mb-6 max-w-[78ch]">{paso.porQue}</p>

      {!org.perfil?.definicion && (
        <p className="mb-6 rounded-[4px] border border-[rgba(201,162,39,0.5)] bg-[rgba(201,162,39,0.08)] p-3 text-[12.5px] text-[#d8c27a]">
          La intención de innovar todavía no está definida. Se puede proponer, pero el encaje solo tiene sentido cuando
          exista contra qué contrastar.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {desafios.map((d, i) => {
          const encaje = leerJson<Encaje>(d.encaje, ENCAJE_VACIO);
          const r = resumirEncaje({ ...ENCAJE_VACIO, ...encaje }, restriccionesOrg);
          const meta = VEREDICTO_META[r.veredicto];
          return (
            <article key={d.id} className="panel">
              <div className="flex flex-wrap items-start gap-3">
                <span className="font-mono text-[12px] text-accent">D{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-[#e8e3d8]">{d.titulo}</h3>
                  <p className="mt-0.5 font-mono text-[10.5px] text-[#5e7370]">
                    {d.origen === "ORGANIZACION" ? "Entregado por la organización" : `Propuesto por ${d.autor.name}`}
                    {d.projectId ? " · ya es un reto" : d.estado === "DESCARTADO" ? " · descartado" : ""}
                  </p>
                </div>
                <span className="rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: meta.color, border: `1px solid ${meta.color}` }}>
                  {meta.label}
                  {r.evaluado ? ` · ${r.puntaje}%` : ""}
                </span>
              </div>
              <div className="mt-3 grid gap-3 text-[12.5px] leading-relaxed text-[#c0ccca] md:grid-cols-3">
                <p><span className="label">Problema</span>{d.problema}</p>
                <p><span className="label">Por qué es relevante</span>{d.porQueRelevante || "—"}</p>
                <p><span className="label">Impacto si se resuelve</span>{d.impacto || "—"}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10.5px] text-[#7f8f8c]">
                {AUTOEVALUACION_DESAFIO.map((a) => {
                  const v = d[a.campo];
                  return <span key={a.campo}>{a.pregunta.replace(/^¿|\?$/g, "")}: {v ? a.opciones[v - 1] : "—"}</span>;
                })}
              </div>

              {editable && !d.projectId && (
                <details className="mt-4 rounded-[3px] border border-[rgba(232,227,216,0.1)] p-3">
                  <summary className="cursor-pointer text-[12.5px] text-accent">Evaluar encaje con la intención de innovar</summary>
                  <form action={evaluarEncaje.bind(null, slug, d.id)} className="mt-4 flex flex-col gap-4">
                    <div>
                      <span className="label">¿Qué tipos de innovación de la organización toca?</span>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {(tiposOrg.length ? tiposOrg : TIPOS_INNOVACION.map((t) => t.key)).map((k) => (
                          <label key={k} className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]">
                            <input type="checkbox" name="tipos" value={k} defaultChecked={encaje.tipos?.includes(k)} className="mt-0.5 accent-[#6FBFB2]" />
                            {TIPOS_INNOVACION.find((t) => t.key === k)?.label ?? k}
                          </label>
                        ))}
                      </div>
                    </div>
                    <SiNo name="brecha" valor={encaje.brecha} label="¿Aporta a la brecha de crecimiento declarada?" />
                    <SiNo name="perfil" valor={encaje.perfil} label="¿Cabe en el perfil de inversión y el horizonte?" />
                    {restriccionesOrg.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="label">¿Respeta lo que la organización no hará?</span>
                        {restriccionesOrg.map((rr, k) => (
                          <SiNo key={rr} name={`restriccion_${k}`} valor={encaje.restricciones?.[rr]} label={rr} />
                        ))}
                      </div>
                    )}
                    <Campo name="nota" label="Nota del equipo" defaultValue={encaje.nota} rows={2} />
                    <div className="flex gap-3">
                      <button type="submit" className="btn btn-primary">Guardar encaje</button>
                    </div>
                  </form>
                  <form action={eliminarDesafio.bind(null, slug, d.id)} className="mt-3">
                    <button type="submit" className="btn btn-danger">Borrar desafío</button>
                  </form>
                </details>
              )}
            </article>
          );
        })}
        {desafios.length === 0 && <p className="hint">Todavía no hay desafíos. Cada persona del equipo propone el suyo.</p>}
      </div>

      {editable && (
        <form action={proponerDesafio.bind(null, slug)} className="mt-8">
          <Bloque n="+" titulo="Proponer un desafío" porQue="Describa el problema que le gustaría resolver: cuál es, por qué es relevante para usted y cuál es el impacto si se resuelve.">
            <Campo name="titulo" label="Título corto" rows={1} required placeholder="Ej. Reducir el consumo de agua cruda de la planta" />
            <Campo name="problema" label="¿Cuál es el problema?" rows={3} required />
            <div className="grid gap-4 md:grid-cols-2">
              <Campo name="porQueRelevante" label="¿Por qué es relevante para usted?" rows={2} />
              <Campo name="impacto" label="¿Cuál es el impacto si se resuelve?" rows={2} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {AUTOEVALUACION_DESAFIO.map((a) => (
                <fieldset key={a.campo}>
                  <legend className="label">{a.pregunta}</legend>
                  <div className="flex flex-col gap-1.5">
                    {a.opciones.map((o, k) => (
                      <label key={o} className="flex items-start gap-2 text-[12px] text-[#a9b5b3]">
                        <input type="radio" name={a.campo} value={k + 1} className="mt-0.5 accent-[#6FBFB2]" />
                        {o}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <label className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]">
              <input type="checkbox" name="origen" value="ORGANIZACION" className="mt-0.5 accent-[#6FBFB2]" />
              La organización entregó este desafío tal cual (por ejemplo, el reto de un sponsor).
            </label>
            <div>
              <button type="submit" className="btn btn-primary">Proponer desafío</button>
            </div>
          </Bloque>
        </form>
      )}
    </div>
  );
}
