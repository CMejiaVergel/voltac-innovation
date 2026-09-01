import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { listTrashedProjects } from "@/lib/projects";
import { TrashList } from "@/components/TrashList";

export const metadata = { title: "Papelera — Voltac Innovacion" };

/**
 * La papelera.
 *
 * Existe porque borrar un proyecto destruye meses de trabajo del equipo y un
 * clic no deberia poder hacerlo. Aqui se ve exactamente cuanto se perderia
 * antes de decidir.
 */
export default async function PapeleraPage() {
  const user = await requireUser();
  const proyectos = await listTrashedProjects(user);

  return (
    <div className="max-w-[880px] pt-8 pb-16">
      <p className="kicker mb-2">Papelera</p>
      <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">
        Proyectos enviados a la papelera
      </h1>
      <p className="hint mt-3 max-w-[70ch]">
        Nada de esto se ha borrado. Cada proyecto conserva su mapa, su historial, su
        bibliografia y sus preguntas, y se puede restaurar entero. El borrado definitivo es
        irreversible y se hace uno por uno.
      </p>

      <div className="mt-7">
        <TrashList
          proyectos={proyectos.map((p) => ({
            slug: p.slug,
            nombre: p.name,
            empresa: p.company,
            trashedAt: p.trashedAt ? p.trashedAt.toISOString() : null,
            fragmentos: p.maps.reduce((a, m) => a + m._count.fragments, 0),
            fuentes: p._count.sources,
            preguntas: p._count.openQuestions,
          }))}
        />
      </div>

      <Link href="/proyectos" className="btn mt-8">
        Volver a los proyectos
      </Link>
    </div>
  );
}
