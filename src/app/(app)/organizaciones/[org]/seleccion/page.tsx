import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrg, leerJson } from "@/lib/organizaciones";
import { canEdit, canAdminProject } from "@/lib/enums";
import { ENCAJE_VACIO, resumirEncaje, VEREDICTO_META, type Encaje } from "@/lib/encaje";
import { votarDesafio, cambiarEstadoDesafio } from "@/app/actions/organizaciones";
import { Avisos, Persona } from "@/components/v2/ui";

export default async function SeleccionPage({
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
  const restriccionesOrg = leerJson<string[]>(org.perfil?.restricciones, []);

  const desafios = await prisma.desafioPropuesto.findMany({
    where: { organizacionId: org.id },
    include: { votos: { include: { user: { select: { id: true, name: true } } } }, autor: { select: { name: true } } },
  });
  const filas = desafios
    .map((d) => {
      const encaje = resumirEncaje({ ...ENCAJE_VACIO, ...leerJson<Encaje>(d.encaje, ENCAJE_VACIO) }, restriccionesOrg);
      return {
        d,
        encaje,
        votos: d.votos.length,
        votantes: d.votos.map((v) => v.user),
        miVoto: d.votos.some((v) => v.userId === user.id),
      };
    })
    .sort((a, b) => b.votos - a.votos);
  const max = Math.max(1, ...filas.map((f) => f.votos));
  const yaVote = filas.some((f) => f.miVoto);

  return (
    <div className="mt-8 max-w-[960px]">
      <Avisos hecho={hecho} error={error} />
      <p className="hint mb-5">Cada persona vota por el desafío más emocionante e impactante. {yaVote ? "Puedes cambiar tu voto mientras no se seleccione." : ""}</p>

      {filas.length === 0 ? (
        <p className="hint">
          No hay desafíos para votar. <Link href={`/organizaciones/${slug}/desafios`} className="text-accent underline">Propongan los primeros</Link>.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {filas.map(({ d, encaje, votos, votantes, miVoto }, i) => {
            const meta = VEREDICTO_META[encaje.veredicto];
            return (
              <li key={d.id} className={`panel ${d.estado === "DESCARTADO" ? "opacity-50" : ""} ${d.estado === "SELECCIONADO" ? "border-accent" : ""}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-mono text-[18px] text-[#5e7370]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold text-[#e8e3d8]">{d.titulo}</p>
                    <p className="mt-0.5 line-clamp-2 text-[12px] text-[#8b9a97]">{d.problema}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="h-1.5 w-40 overflow-hidden rounded-full bg-[#22302f]">
                        <span className="block h-full bg-accent" style={{ width: `${(votos / max) * 100}%` }} />
                      </span>
                      <span className="font-mono text-[10.5px] text-[#7f8f8c]">
                        {votos} voto{votos === 1 ? "" : "s"}
                      </span>
                      <span className="flex -space-x-1.5">
                        {votantes.map((v) => (
                          <Persona key={v.id} id={v.id} nombre={v.name} tam={20} />
                        ))}
                      </span>
                      {encaje.evaluado && (
                        <span className="font-mono text-[10px]" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {canEdit(role) && d.estado !== "DESCARTADO" && !d.projectId && (
                    <form action={votarDesafio.bind(null, slug, d.id)}>
                      <button className={`btn ${miVoto ? "btn-primary" : ""}`}>{miVoto ? "✓ Tu voto" : "Votar"}</button>
                    </form>
                  )}

                  {canAdminProject(role) && !d.projectId && (
                    <div className="flex gap-2">
                      {d.estado !== "SELECCIONADO" && d.estado !== "DESCARTADO" && (
                        <form action={cambiarEstadoDesafio.bind(null, slug, d.id, "SELECCIONADO")}>
                          <button className="btn btn-primary">Seleccionar</button>
                        </form>
                      )}
                      {d.estado === "SELECCIONADO" && (
                        <Link href={`/organizaciones/${slug}/reto?desafio=${d.id}`} className="btn btn-primary">
                          Diseñar el reto
                        </Link>
                      )}
                      <form action={cambiarEstadoDesafio.bind(null, slug, d.id, d.estado === "DESCARTADO" ? "PROPUESTO" : "DESCARTADO")}>
                        <button className="btn">{d.estado === "DESCARTADO" ? "Reabrir" : "Descartar"}</button>
                      </form>
                    </div>
                  )}
                  {d.projectId && <span className="font-mono text-[10.5px] text-accent">Ya es un reto</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
