import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { requireProject } from "@/lib/projects";
import { PROJECT_ROLE_LABEL } from "@/lib/enums";
import { ProjectTabs } from "@/components/ProjectTabs";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);

  return (
    <div className="pt-7">
      <div className="no-print flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="kicker mb-2">
            {project.program ? `${project.program} · ` : ""}
            {project.company ?? "Proyecto de innovacion"}
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#e8e3d8]">
            <Link href={`/proyectos/${slug}`}>{project.name}</Link>
          </h1>
        </div>
        <div className="flex-1" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5e7370]">
          Tu rol: {PROJECT_ROLE_LABEL[role]}
        </span>
      </div>

      <ProjectTabs slug={slug} />

      {children}
    </div>
  );
}
