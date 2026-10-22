import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrg, leerJson } from "@/lib/organizaciones";
import { canEdit, canAdminProject } from "@/lib/enums";
import { ENCAJE_VACIO, resumirEncaje, VEREDICTO_META, type Encaje } from "@/lib/encaje";
import { votarDesafio, cambiarEstadoDesafio } from "@/app/actions/organizaciones";
import { Avisos } from "@/components/v2/ui";

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
    include: { votos: true, autor: { select: { name: true } } },
  });
  const filas = desafios
    .map((d) => {
      const encaje = resumirEncaje({ ...ENCAJE_VACIO, ...leerJson<Encaje>(d.encaje, ENCAJE_VACIO) }, restriccionesOrg);
      return {
        d,
        encaje,
        puntos: d.votos.reduce((a, v) => a + v.puntos, 0),
        votantes: d.votos.length,
        miVoto: d.votos.find((v) => v.userId === user.id)?.puntos ?? 0,
      };
    })
    .sort((a, b) => b.puntos - a.puntos || b.encaje.puntaje - a.encaje.puntaje);
  const max = Math.max(1, ...filas.map((f) => f.puntos));

  return (
    <div className="mt-8 max-w-[960px]">
      <Avisos hecho={hecho} error={error} />
      <p className="hint mb-5">Den 3 puntos al desafío que más los emociona, 2 y 1 a los siguientes.</p>

      {filas.length === 0 ? (
        <p className="hint">
          No hay desafíos para votar. <Link href={`/organizaciones/${slug}/desafios`} className="text-accent underline">Propongan los primeros</Link>.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {filas.map(({ d, encaje, puntos, votantes, miVoto }, i) => {
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
                        <span className="block h-full bg-accent" style={{ width: `${(puntos / max) * 100}%` }} />
                      </span>
                      <span className="font-mono text-[10.5px] text-[#7f8f8c]">
                        {puntos} pts · {votantes} voto{votantes === 1 ? "" : "s"}
                      </span>
                      {encaje.evaluado && (
                        <span className="font-mono text-[10px]" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {canEdit(role) && d.estado !== "DESCARTADO" && !d.projectId && (
                    <form action={votarDesafio.bind(null, slug, d.id)} className="flex items-center gap-1">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          name="puntos"
                          value={miVoto === n ? 0 : n}
                          title={miVoto === n ? "Quitar mi voto" : `Dar ${n} puntos`}
                          className={`btn px-2.5 ${miVoto === n ? "btn-primary" : ""}`}
                        >
                          {n}
                        </button>
                      ))}
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
