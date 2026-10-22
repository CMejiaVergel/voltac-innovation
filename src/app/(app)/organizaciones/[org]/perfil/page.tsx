import { requireUser } from "@/lib/auth";
import { requireOrg, leerJson } from "@/lib/organizaciones";
import { canEdit } from "@/lib/enums";
import { TIPOS_INNOVACION, RAZON_DE_CAMBIO, EJES_PERFIL, HORIZONTES, PASOS_CONFIGURAR } from "@/lib/gimi";
import { guardarPerfil } from "@/app/actions/organizaciones";
import { SaveBar } from "@/components/SaveBar";
import { Avisos, Bloque, Campo, DecideElEquipo } from "@/components/v2/ui";

const lineas = (raw: string | undefined) => leerJson<string[]>(raw, []).join("\n");

export default async function PerfilPage({
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
  const p = org.perfil;
  const tipos = leerJson<string[]>(p?.tiposInnovacion, []);
  const razones = leerJson<string[]>(p?.razonesCambio, []);
  const paso = PASOS_CONFIGURAR[0];

  return (
    <form action={guardarPerfil.bind(null, slug)} className="mt-8 max-w-[900px]">
      <Avisos hecho={hecho} error={error} />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <p className="kicker">Paso 1 · {paso.nombre}</p>
        <DecideElEquipo />
      </div>
      <p className="hint mb-7 max-w-[78ch]">{paso.porQue}</p>

      <fieldset disabled={!canEdit(role)} className="flex flex-col gap-6">
        <Bloque
          n="1.1"
          titulo="Definición de innovación"
          porQue="Qué significa innovar para esta organización. Es una declaración que el equipo decide: define qué retos entran y cuáles no."
        >
          <Campo
            name="definicion"
            label="Para nosotros, innovar es…"
            defaultValue={p?.definicion}
            rows={3}
            placeholder="Ej. Desarrollar nuevos productos y mejorar procesos que reduzcan el consumo de recursos de la planta."
          />
          <div>
            <span className="label">En qué queremos innovar</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {TIPOS_INNOVACION.map((t) => (
                <label key={t.key} className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]">
                  <input type="checkbox" name="tiposInnovacion" value={t.key} defaultChecked={tipos.includes(t.key)} className="mt-0.5 accent-[#6FBFB2]" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <Campo name="dondeInnovar" label="Dónde" help="Mercados, geografías, líneas de negocio o campos de juego en los que queremos jugar." defaultValue={p?.dondeInnovar} rows={2} />
          <Campo name="queNoEsInnovar" label="Qué NO es innovación para nosotros" help="Lo que queda fuera aunque parezca una buena oportunidad." defaultValue={p?.queNoEsInnovar} rows={2} />
        </Bloque>

        <Bloque
          n="1.2"
          titulo="Razón de cambio"
          porQue="Un argumento convincente para el cambio que le dé propósito a la innovación: ¿quién o qué empuja?"
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {RAZON_DE_CAMBIO.map((r) => (
              <label key={r.key} className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]">
                <input type="checkbox" name="razonesCambio" value={r.key} defaultChecked={razones.includes(r.key)} className="mt-0.5 accent-[#6FBFB2]" />
                {r.label}
              </label>
            ))}
          </div>
          <Campo name="argumentoCambio" label="El argumento para el cambio" defaultValue={p?.argumentoCambio} rows={3} />
        </Bloque>

        <Bloque
          n="1.3"
          titulo="Brecha de crecimiento"
          porQue="Cuánto se quiere lograr con la innovación y para cuándo. Muestra definitivamente cuánto y cuándo innovar."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo name="brechaCuanto" label="¿Cuánto?" rows={1} placeholder="Ej. 10% de nuevos ingresos" defaultValue={p?.brechaCuanto} />
            <Campo name="brechaCuando" label="¿Para cuándo?" rows={1} placeholder="Ej. 2028" defaultValue={p?.brechaCuando} />
          </div>
          <Campo name="objetivos" label="Objetivos de crecimiento" help="Uno por línea." defaultValue={lineas(p?.objetivos)} rows={3} />
          <Campo name="metricas" label="Métricas" help="Uno por línea. Cómo se medirá que la brecha se cierra." defaultValue={lineas(p?.metricas)} rows={3} />
        </Bloque>

        <Bloque
          n="1.4"
          titulo="Perfil de inversión"
          porQue="Qué tipo de proyectos son apropiados. Ubica la organización entre cada par de polos y escribe lo que no hará: es lo que permite decir que no a un reto."
        >
          <div className="grid gap-5">
            {EJES_PERFIL.map((e) => (
              <fieldset key={e.campo}>
                <legend className="label">{e.nombre}</legend>
                <div className="flex items-center gap-3 text-[12px] text-[#a9b5b3]">
                  <span className="w-28 text-right">{e.izquierda}</span>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <label key={v} className="flex flex-col items-center gap-1">
                      <input type="radio" name={e.campo} value={v} defaultChecked={(p?.[e.campo] ?? 0) === v} className="accent-[#6FBFB2]" />
                      <span className="font-mono text-[10px] text-[#5e7370]">{v}</span>
                    </label>
                  ))}
                  <span className="w-28">{e.derecha}</span>
                </div>
              </fieldset>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo name="presupuesto" label="Presupuesto disponible" rows={1} placeholder="Ej. Sin capital para infraestructura" defaultValue={p?.presupuesto} />
            <label className="block">
              <span className="label">Horizonte</span>
              <select name="horizonte" defaultValue={p?.horizonte ?? ""} className="field">
                <option value="">—</option>
                {HORIZONTES.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Campo
            name="restricciones"
            label="Lo que la organización no hará"
            help="Una por línea. Ej. «No invertimos en infraestructura física», «Solo proyectos internacionales». Cada desafío se contrasta con esta lista."
            defaultValue={lineas(p?.restricciones)}
            rows={4}
          />
        </Bloque>

        <Bloque n="1.5" titulo="Prospección futura (opcional)" porQue="Cómo se ve el entorno de la organización a futuro: tendencias o escenarios que deben guiar la innovación.">
          <Campo name="prospeccion" label="Escenarios o tendencias a tener en cuenta" defaultValue={p?.prospeccion} rows={3} />
        </Bloque>
      </fieldset>

      {canEdit(role) && <SaveBar label="Guardar intención de innovar" />}
    </form>
  );
}
