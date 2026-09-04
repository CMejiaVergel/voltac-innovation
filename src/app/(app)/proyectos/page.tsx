import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { listProjectsFor } from "@/lib/projects";
import { ImportBackup } from "@/components/ImportBackup";

export const metadata = { title: "Proyectos — Voltac Innovacion" };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjectsFor(user);

  return (
    <div className="pt-8">
      <div className="flex items-end gap-6">
        <div>
          <p className="kicker mb-2">Portafolio</p>
          <h1 className="text-[32px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">
            Proyectos de innovacion
          </h1>
        </div>
        <div className="flex-1" />
        <ImportBackup />
        <Link href="/proyectos/papelera" className="btn">
          Papelera
        </Link>
        <Link href="/proyectos/nuevo" className="btn btn-primary">
          Nuevo proyecto
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="panel mt-8">
          <p className="hint">
            Todavia no tienes proyectos. Crea uno para empezar por la etapa Configurar del
            proceso IDEX: definir el reto, la meta y el alcance.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const fragments = p.maps.reduce((a, m) => a + m._count.fragments, 0);
            return (
              <li key={p.id}>
                <Link
                  href={`/proyectos/${p.slug}`}
                  className="panel block h-full transition hover:border-[rgba(111,191,178,0.5)]"
                >
                  {p.program && <p className="kicker mb-2">{p.program}</p>}
                  <h2 className="text-[17px] font-semibold leading-tight text-[#e8e3d8]">
                    {p.name}
                  </h2>
                  {p.company && (
                    <p className="mt-1.5 text-[12px] text-[#8b9a97]">{p.company}</p>
                  )}
                  <div className="mt-4 flex gap-4 font-mono text-[10.5px] text-[#5e7370]">
                    <span>{fragments} fragmentos</span>
                    <span>{p._count.members} miembros</span>
                    <span>{p._count.openQuestions} preguntas</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
