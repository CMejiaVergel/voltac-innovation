import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrg, leerJson } from "@/lib/organizaciones";
import { TIPOS_INNOVACION, EJES_PERFIL, HORIZONTES, PREGUNTAS_SETUP } from "@/lib/gimi";

export default async function OrgResumenPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const user = await requireUser();
  const { org } = await requireOrg(user, slug);
  const p = org.perfil;
  const retos = await prisma.project.findMany({
    where: { organizacionId: org.id, status: { not: "TRASHED" } },
    select: { slug: true, name: true, brief: { select: { meta: true } } },
  });

  const tipos = leerJson<string[]>(p?.tiposInnovacion, []);
  const restricciones = leerJson<string[]>(p?.restricciones, []);

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="panel">
        <div className="flex items-center gap-3">
          <h2 className="kicker">Intención de innovar</h2>
          <div className="flex-1" />
          <Link href={`/organizaciones/${slug}/perfil`} className="btn">
            {p?.definicion ? "Editar" : "Definir"}
          </Link>
        </div>
        {p?.definicion ? (
          <div className="mt-4 flex flex-col gap-4 text-[13px] leading-relaxed text-[#c0ccca]">
            <p className="text-[15px] text-[#e8e3d8]">«{p.definicion}»</p>
            {tipos.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tipos.map((t) => (
                  <span key={t} className="rounded-full border border-[rgba(111,191,178,0.4)] px-2.5 py-0.5 text-[11px] text-accent">
                    {TIPOS_INNOVACION.find((x) => x.key === t)?.label ?? t}
                  </span>
                ))}
              </div>
            )}
            {(p.brechaCuanto || p.brechaCuando) && (
              <p>
                <span className="label inline">Brecha</span> {p.brechaCuanto}
                {p.brechaCuando ? ` · para ${p.brechaCuando}` : ""}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {EJES_PERFIL.map((e) => {
                const v = p[e.campo];
                return (
                  <div key={e.campo} className="text-[11.5px]">
                    <span className="text-[#7f8f8c]">{e.nombre}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="w-20 text-right text-[#7f8f8c]">{e.izquierda}</span>
                      <span className="relative h-1.5 flex-1 rounded-full bg-[#22302f]">
                        {v > 0 && (
                          <span
                            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
                            style={{ left: `${((v - 1) / 4) * 100}%` }}
                          />
                        )}
                      </span>
                      <span className="w-20 text-[#7f8f8c]">{e.derecha}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {p.horizonte && <p className="text-[12px]">Horizonte: {HORIZONTES.find((h) => h.key === p.horizonte)?.label}</p>}
            {restricciones.length > 0 && (
              <div>
                <span className="label">Lo que no haremos</span>
                <ul className="list-disc pl-5 text-[12.5px]">
                  {restricciones.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="hint mt-4">
            Todavía no está definida. Es el primer paso: sin ella no hay contra qué contrastar los desafíos.
          </p>
        )}
      </section>

      <div className="flex flex-col gap-6">
        <section className="panel">
          <h2 className="kicker mb-3">Retos de esta organización</h2>
          {retos.length === 0 ? (
            <p className="hint">Aún no hay retos. Nacen en el paso 4, desde el desafío seleccionado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {retos.map((r) => (
                <li key={r.slug}>
                  <Link href={`/proyectos/${r.slug}`} className="block rounded-[3px] border border-[rgba(232,227,216,0.12)] px-3 py-2 hover:border-accent">
                    <span className="text-[13px] text-[#e8e3d8]">{r.name}</span>
                    {r.brief?.meta && <span className="mt-0.5 block line-clamp-2 text-[11px] text-[#7f8f8c]">{r.brief.meta}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2 className="kicker mb-3">Preguntas guía del Set Up</h2>
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-[#a9b5b3]">
            {PREGUNTAS_SETUP.map((q) => (
              <li key={q}>· {q}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
