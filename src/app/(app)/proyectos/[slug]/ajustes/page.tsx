import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject, getPrimaryMap } from "@/lib/projects";
import { canAdminProject } from "@/lib/enums";
import { ProjectSettings } from "@/components/ProjectSettings";

export default async function AjustesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);

  if (!canAdminProject(role)) {
    return (
      <p className="hint mt-8">
        Solo el responsable del proyecto puede cambiar sus datos o enviarlo a la papelera.
      </p>
    );
  }

  const primary = await getPrimaryMap(project.id);
  const fragmentos = primary
    ? await prisma.fragment.count({ where: { mapId: primary.map.id } })
    : 0;

  return (
    <div className="mt-7 max-w-[720px] pb-16">
      <ProjectSettings
        slug={slug}
        nombre={project.name}
        empresa={project.company ?? ""}
        programa={project.program ?? ""}
        fragmentos={fragmentos}
      />
    </div>
  );
}
