import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrg, leerJson } from "@/lib/organizaciones";
import { canAdminProject } from "@/lib/enums";
import { ENCAJE_VACIO, resumirEncaje, VEREDICTO_META, type Encaje } from "@/lib/encaje";
import { crearReto } from "@/app/actions/organizaciones";
import { CamposReto } from "@/components/v2/CamposReto";
import { Avisos, Campo } from "@/components/v2/ui";
import { SaveBar } from "@/components/SaveBar";

export default async function RetoPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ desafio?: string; hecho?: string; error?: string }>;
}) {
  const { org: slug } = await params;
  const { desafio: desafioId, hecho, error } = await searchParams;
  const user = await requireUser();
  const { org, role } = await requireOrg(user, slug);

  const seleccionados = await prisma.desafioPropuesto.findMany({
    where: { organizacionId: org.id, estado: "SELECCIONADO" },
    include: { project: { select: { slug: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const d = seleccionados.find((x) => x.id === desafioId) ?? seleccionados.find((x) => !x.projectId);

  const restriccionesOrg = leerJson<string[]>(org.perfil?.restricciones, []);

  return (
    <div className="mt-8 max-w-[900px]">
      <Avisos hecho={hecho} error={error} />

      {seleccionados.some((x) => x.projectId) && (
        <section className="panel mb-6">
          <h2 className="kicker mb-2">Retos creados</h2>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {seleccionados
              .filter((x) => x.project)
              .map((x) => (
                <li key={x.id}>
                  <Link href={`/proyectos/${x.project!.slug}`} className="text-accent underline">
                    {x.project!.name}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      {!d || d.projectId ? (
        <p className="hint">
          Primero elijan un desafío en la{" "}
          <Link href={`/organizaciones/${slug}/seleccion`} className="text-accent underline">
            votación
          </Link>
          .
        </p>
      ) : (
        <form action={crearReto.bind(null, slug, d.id)} className="flex flex-col gap-6">
          {(() => {
            const r = resumirEncaje({ ...ENCAJE_VACIO, ...leerJson<Encaje>(d.encaje, ENCAJE_VACIO) }, restriccionesOrg);
            const meta = VEREDICTO_META[r.veredicto];
            return (
              <section className="panel">
                <p className="kicker mb-1">Desafío seleccionado</p>
                <h2 className="text-[17px] font-semibold text-[#e8e3d8]">{d.titulo}</h2>
                <p className="mt-2 text-[12.5px] text-[#a9b5b3]">{d.problema}</p>
                {r.evaluado && (
                  <p className="mt-2 font-mono text-[10.5px]" style={{ color: meta.color }}>
                    {meta.label} · {r.puntaje}%
                  </p>
                )}
                {r.rompeRestriccion && (
                  <p className="mt-2 text-[12px] text-[#e8a99c]">
                    Rompe una de las restricciones de la organización.
                  </p>
                )}
              </section>
            );
          })()}

          <fieldset disabled={!canAdminProject(role)} className="flex flex-col gap-6">
            <section className="panel flex flex-col gap-4">
              <Campo name="name" label="Nombre del reto" rows={1} defaultValue={d.titulo} />
              <Campo name="program" label="Programa o convocatoria (opcional)" rows={1} placeholder="Ej. Caribe Innova 2026" />
            </section>
            <CamposReto
              v={{
                challengeText: d.origen === "ORGANIZACION" ? d.problema : "",
                problema: d.problema,
                porQueMotivante: d.porQueRelevante,
                meta: "",
              }}
            />
          </fieldset>
          {canAdminProject(role) && <SaveBar label="Crear el reto" />}
        </form>
      )}
    </div>
  );
}
