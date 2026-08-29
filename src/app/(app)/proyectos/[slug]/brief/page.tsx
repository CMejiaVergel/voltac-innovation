import { requireUser } from "@/lib/auth";
import { requireProject } from "@/lib/projects";
import { canEdit } from "@/lib/enums";
import { SOLUTION_FOCI, RAZON_DE_CAMBIO, PERFIL_INVERSION, HATS, IDEX } from "@/lib/gimi";
import { updateBrief } from "@/app/actions/projects";
import { SaveBar } from "@/components/SaveBar";

function list(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.join("\n") : "";
  } catch {
    return "";
  }
}

function selected(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);
  const brief = project.brief;
  const editable = canEdit(role);

  const foci = selected(brief?.solutionFoci);
  const setup = IDEX[0];

  const save = updateBrief.bind(null, slug);

  return (
    <form action={save} className="mt-7 max-w-[880px] pb-24">
      <div className="mb-6 flex items-center gap-3">
        <p className="kicker">Etapa 1 · {setup.name} — {setup.purpose}</p>
        <div className="flex gap-1">
          {setup.hats.map((h) => (
            <span
              key={h}
              title={`Sombrero ${HATS[h].name}: ${HATS[h].trait}`}
              className="inline-block h-2.5 w-2.5 rounded-full border border-black/30"
              style={{ background: HATS[h].color }}
            />
          ))}
        </div>
      </div>

      <p className="hint mb-7 max-w-[70ch]">
        Este es el insumo del agente investigador. Cuanto mas concreto sea, menos supuestos
        producira. Lo que aqui no este, el agente lo tendra que inferir — y lo marcara como
        supuesto o lo devolvera como pregunta.
      </p>

      <fieldset disabled={!editable} className="flex flex-col gap-6">
        {/* ── El reto ────────────────────────────────────────────────────── */}
        <section className="panel flex flex-col gap-5">
          <h2 className="kicker">El reto</h2>

          <Field
            name="challengeText"
            label="Reto textual entregado por la empresa"
            help="Literal. El agente lo cita tal cual y no lo reinterpreta."
            defaultValue={brief?.challengeText ?? ""}
            rows={3}
          />
          <Field
            name="problema"
            label="Que problema se busca resolver"
            help="Ejercicio 2.1.1 de la plantilla GIMI."
            defaultValue={brief?.problema ?? ""}
            rows={4}
          />
          <Field
            name="porQueMotivante"
            label="Por que es motivante"
            help="Por que le importa a este equipo y que cambia si se resuelve."
            defaultValue={brief?.porQueMotivante ?? ""}
            rows={3}
          />
          <Field
            name="meta"
            label="Cual es la meta"
            help="Ejercicio 2.1.3: brecha a cerrar y para cuando. Con cifra y fecha si existen."
            defaultValue={brief?.meta ?? ""}
            rows={3}
          />
        </section>

        {/* ── Alcance ────────────────────────────────────────────────────── */}
        <section className="panel flex flex-col gap-5">
          <h2 className="kicker">Alcance del desafio</h2>

          <div>
            <span className="label">A que se refieren las soluciones</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {SOLUTION_FOCI.map((f) => (
                <label key={f.key} className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]">
                  <input
                    type="checkbox"
                    name="solutionFoci"
                    value={f.key}
                    defaultChecked={foci.includes(f.key)}
                    className="mt-0.5 accent-[#6FBFB2]"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <Field
            name="queHacer"
            label="Que hacer (una linea por punto)"
            help="Lo que la empresa pidio explicitamente perseguir."
            defaultValue={list(brief?.queHacer)}
            rows={5}
          />
          <Field
            name="queEvitar"
            label="Que evitar (una linea por punto)"
            help="El agente no propondra fragmentos que empujen hacia aqui."
            defaultValue={list(brief?.queEvitar)}
            rows={5}
          />
          <Field
            name="restricciones"
            label="Restricciones duras"
            help="Economicas, legales, tecnicas. Lo que hace inviable una solucion."
            defaultValue={brief?.restricciones ?? ""}
            rows={4}
          />
        </section>

        {/* ── Intencion de innovar ───────────────────────────────────────── */}
        <section className="panel flex flex-col gap-5">
          <h2 className="kicker">Intencion de innovar</h2>
          <p className="hint -mt-2">
            Marco GIMI: la razon de cambio y el perfil de inversion definen que tan lejos del
            nucleo puede ir la solucion.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="razonDeCambio">
                Razon de cambio
              </label>
              <select
                id="razonDeCambio"
                name="razonDeCambio"
                className="field"
                defaultValue={brief?.razonDeCambio ?? ""}
              >
                <option value="">Sin definir</option>
                {RAZON_DE_CAMBIO.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="perfilInversion">
                Perfil de inversion
              </label>
              <select
                id="perfilInversion"
                name="perfilInversion"
                className="field"
                defaultValue={brief?.perfilInversion ?? ""}
              >
                <option value="">Sin definir</option>
                {PERFIL_INVERSION.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Field
            name="brechaCrecimiento"
            label="Brecha de crecimiento"
            help="Cuanto y para cuando."
            defaultValue={brief?.brechaCrecimiento ?? ""}
            rows={2}
          />
        </section>

        {/* ── Guia para el agente ────────────────────────────────────────── */}
        <section className="panel flex flex-col gap-5">
          <h2 className="kicker">Guia de busqueda para el agente</h2>

          <Field
            name="agentHints"
            label="Priorizar en la busqueda"
            help="Terminos tecnicos, normas, regiones, nombres de plantas o empresas del entorno."
            defaultValue={brief?.agentHints ?? ""}
            rows={3}
          />
          <Field
            name="agentExclude"
            label="Excluir de la busqueda"
            help="Rutas que ya se descartaron y no vale la pena volver a mirar."
            defaultValue={brief?.agentExclude ?? ""}
            rows={3}
          />
        </section>
      </fieldset>

      {editable && <SaveBar label="Guardar el brief" />}
    </form>
  );
}

function Field({
  name,
  label,
  help,
  defaultValue,
  rows,
}: {
  name: string;
  label: string;
  help?: string;
  defaultValue: string;
  rows: number;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        className="field resize-y leading-relaxed"
      />
      {help && <p className="mt-1.5 text-[11px] text-[#5e7370]">{help}</p>}
    </div>
  );
}
