import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import { leerJson } from "@/lib/organizaciones";
import { canEdit } from "@/lib/enums";
import { TIPOS_INNOVACION } from "@/lib/gimi";
import { ENCAJE_VACIO, resumirEncaje, VEREDICTO_META, type Encaje } from "@/lib/encaje";
import { actualizarReto } from "@/app/actions/organizaciones";
import { CamposReto } from "@/components/v2/CamposReto";
import { Avisos } from "@/components/v2/ui";
import { SaveBar } from "@/components/SaveBar";

export default async function ConfigurarRetoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ hecho?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { hecho, error } = await searchParams;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);
  const org = project.organizacionId
    ? await prisma.organizacion.findUnique({ where: { id: project.organizacionId }, include: { perfil: true } })
    : null;
  const desafio = await prisma.desafioPropuesto.findUnique({ where: { projectId: project.id } });
  const b = project.brief;

  const tipos = leerJson<string[]>(org?.perfil?.tiposInnovacion, []);
  const encaje = desafio
    ? resumirEncaje({ ...ENCAJE_VACIO, ...leerJson<Encaje>(desafio.encaje, ENCAJE_VACIO) }, leerJson<string[]>(org?.perfil?.restricciones, []))
    : null;

  return (
    <div className="mt-7 pb-24">
      <Avisos hecho={hecho} error={error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form action={actualizarReto.bind(null, slug)} className="flex flex-col gap-6">
          <fieldset disabled={!canEdit(role)} className="flex flex-col gap-6">
            <CamposReto v={b ?? {}} />
          </fieldset>
          {canEdit(role) && <SaveBar label="Guardar el reto" />}
        </form>

        <aside className="flex flex-col gap-4">
          <section className="panel">
            <h2 className="kicker mb-2">Origen</h2>
            {org ? (
              <div className="flex flex-col gap-3 text-[12.5px] text-[#a9b5b3]">
                <p>
                  <Link href={`/organizaciones/${org.slug}`} className="text-accent underline">
                    {org.name}
                  </Link>
                </p>
                {org.perfil?.definicion && <p className="text-[#e8e3d8]">«{org.perfil.definicion}»</p>}
                {tipos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tipos.map((t) => (
                      <span key={t} className="rounded-full border border-[rgba(111,191,178,0.4)] px-2 py-0.5 text-[10.5px] text-accent">
                        {TIPOS_INNOVACION.find((x) => x.key === t)?.label ?? t}
                      </span>
                    ))}
                  </div>
                )}
                {desafio && encaje && (
                  <p>
                    Desafío «{desafio.titulo}» ·{" "}
                    <span style={{ color: VEREDICTO_META[encaje.veredicto].color }}>
                      {VEREDICTO_META[encaje.veredicto].label}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className="hint">
                Este reto aún no está ligado a una organización. Pueden crearla en{" "}
                <Link href="/organizaciones" className="text-accent underline">
                  Organizaciones
                </Link>
                .
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
