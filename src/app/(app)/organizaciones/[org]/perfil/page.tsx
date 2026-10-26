import { requireUser } from "@/lib/auth";
import { requireOrg, leerJson } from "@/lib/organizaciones";
import { canEdit } from "@/lib/enums";
import { TIPOS_INNOVACION, RAZON_DE_CAMBIO, EJES_PERFIL, POSICIONAMIENTO, frasesIntencion, tiposVigentes } from "@/lib/gimi";
import { guardarPerfil } from "@/app/actions/organizaciones";
import { SaveBar } from "@/components/SaveBar";
import { Avisos, Bloque, Campo } from "@/components/v2/ui";
import { ResumenIntencion } from "@/components/v2/ResumenIntencion";

const lineas = (raw: string | undefined) => leerJson<string[]>(raw, []).join("\n");

/**
 * Paso 1 del IMBOK, Intención de Innovar (pp. 28-35): razón de cambio, brecha
 * de crecimiento y perfil de inversión, precedidos por la definición de
 * innovación que la organización acuerda (IMBOK p. 15). Cada bloque cierra
 * con la frase plantilla del IMBOK, que se arma sola en el resumen.
 */
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
  const tipos = tiposVigentes(leerJson<string[]>(p?.tiposInnovacion, []));
  const razones = leerJson<string[]>(p?.razonesCambio, []);
  // «Qué NO es innovación» y «Lo que no haremos» eran dos campos para lo mismo
  // (los límites de la innovación, IMBOK p. 28). Lo viejo se ofrece aquí y al
  // guardar queda en un solo campo.
  const limites = [lineas(p?.restricciones), p?.queNoEsInnovar ?? ""].filter((x) => x.trim()).join("\n");

  return (
    <form action={guardarPerfil.bind(null, slug)} className="mt-8 max-w-[900px]">
      <Avisos hecho={hecho} error={error} />

      {p && <ResumenIntencion frases={frasesIntencion(p)} />}

      <fieldset disabled={!canEdit(role)} className="flex flex-col gap-6">
        <Bloque titulo="Definición de innovación" porQue="Que todos en la organización hablen de lo mismo cuando dicen «innovar».">
          <Campo
            name="definicion"
            label="Para nosotros, innovar es…"
            defaultValue={p?.definicion}
            rows={3}
            placeholder="El GIMI la define como crear y capturar nuevo valor de nuevas formas. ¿Cómo la entienden ustedes?"
          />
          <div>
            <span className="label">¿En qué parte de la cadena de valor?</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {TIPOS_INNOVACION.map((t) => (
                <label key={t.key} className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]">
                  <input type="checkbox" name="tiposInnovacion" value={t.key} defaultChecked={tipos.includes(t.key)} className="mt-0.5 accent-[#6FBFB2]" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <Campo name="dondeInnovar" label="¿Dónde?" help="Mercados, geografías o líneas de negocio." defaultValue={p?.dondeInnovar} rows={2} />
        </Bloque>

        <Bloque titulo="Razón de cambio" porQue="Por qué la organización necesita innovar, y quién o qué la empuja.">
          <div className="grid gap-2 sm:grid-cols-3">
            {RAZON_DE_CAMBIO.map((r) => (
              <label key={r.key} className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]">
                <input type="checkbox" name="razonesCambio" value={r.key} defaultChecked={razones.includes(r.key)} className="mt-0.5 accent-[#6FBFB2]" />
                {r.label}
              </label>
            ))}
          </div>
          <Campo
            name="argumentoCambio"
            label="Necesitamos innovar porque…"
            defaultValue={p?.argumentoCambio}
            rows={3}
            placeholder="Conecten el impulso con un resultado que se pueda medir."
          />
        </Bloque>

        <Bloque titulo="Brecha de crecimiento" porQue="La distancia entre hacia dónde va la organización si no cambia y adónde quiere llegar: muestra el tamaño y la urgencia.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo name="brechaCuanto" label="¿Qué tan grande es la brecha?" rows={1} placeholder="Ej. 10% de nuevos ingresos" defaultValue={p?.brechaCuanto} />
            <Campo name="brechaCuando" label="¿Cuánto tiempo tenemos?" rows={1} placeholder="Ej. los próximos 3 años" defaultValue={p?.brechaCuando} />
          </div>
          <Campo name="objetivos" label="Objetivos de crecimiento" help="Uno por línea." defaultValue={lineas(p?.objetivos)} rows={3} />
          <Campo name="metricas" label="Métricas" help="Una por línea." defaultValue={lineas(p?.metricas)} rows={3} />
        </Bloque>

        <Bloque titulo="Perfil de inversión" porQue="Qué tipo de proyectos acepta la organización para cerrar la brecha.">
          <div className="grid gap-4 sm:grid-cols-2">
            {(["posicionActual", "posicionDeseada"] as const).map((campo) => (
              <fieldset key={campo}>
                <legend className="label">{campo === "posicionActual" ? "Hoy somos…" : "Queremos ser…"}</legend>
                <div className="flex flex-col gap-1.5">
                  {POSICIONAMIENTO.map((o) => (
                    <label key={o.key} className="flex items-start gap-2 text-[12.5px] text-[#a9b5b3]" title={o.ayuda}>
                      <input type="radio" name={campo} value={o.key} defaultChecked={p?.[campo] === o.key} className="mt-0.5 accent-[#6FBFB2]" />
                      <span>
                        <b className="text-[#e8e3d8]">{o.label}</b> <span className="text-[11.5px] text-[#7f8f8c]">— {o.ayuda}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div>
            <div className="mb-2 flex justify-between text-[11px] uppercase tracking-[0.12em] text-[#7f8f8c]">
              <span>Táctico</span>
              <span>Estratégico</span>
            </div>
            <div className="grid gap-3">
              {EJES_PERFIL.map((e) => (
                <fieldset key={e.campo} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-[12px] text-[#a9b5b3]">
                  <legend className="sr-only">{e.nombre}</legend>
                  <span className="text-right">{e.izquierda}</span>
                  <span className="flex gap-2.5">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <input
                        key={v}
                        type="radio"
                        name={e.campo}
                        value={v}
                        defaultChecked={(p?.[e.campo] ?? 0) === v}
                        aria-label={`${e.nombre}: ${v}`}
                        className="h-4 w-4 accent-[#6FBFB2]"
                      />
                    ))}
                  </span>
                  <span>{e.derecha}</span>
                </fieldset>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo name="presupuesto" label="Nivel de inversión" rows={1} placeholder="Ej. inversiones medianas" defaultValue={p?.presupuesto} />
            <Campo name="perfilOtro" label="Otro" rows={1} placeholder="Otra condición del perfil" defaultValue={p?.perfilOtro} />
          </div>
          <Campo
            name="restricciones"
            label="Límites: lo que no haremos"
            help="Una por línea. Ej. «No invertimos en infraestructura física»."
            defaultValue={limites}
            rows={4}
          />
        </Bloque>
      </fieldset>

      {canEdit(role) && <SaveBar label="Guardar y continuar" />}
    </form>
  );
}
