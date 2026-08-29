import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import { canAdminProject, PROJECT_ROLES, PROJECT_ROLE_LABEL, asEnum } from "@/lib/enums";
import { addMember, removeMember } from "@/app/actions/projects";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const { project, role } = await requireProject(user, slug);
  const isOwner = canAdminProject(role);

  const members = await prisma.membership.findMany({
    where: { projectId: project.id },
    include: { user: { select: { id: true, name: true, email: true, active: true } } },
    orderBy: { createdAt: "asc" },
  });

  const invite = addMember.bind(null, slug);

  return (
    <div className="mt-7 max-w-[720px] pb-16">
      <h2 className="kicker mb-2">Equipo del proyecto</h2>
      <p className="hint mb-6">
        Solo los miembros ven este proyecto. Los lectores pueden consultar el mapa pero no
        modificarlo ni correr el agente.
      </p>

      <ul className="flex flex-col gap-2">
        {members.map((m) => {
          const r = asEnum(PROJECT_ROLES, m.role, "VIEWER");
          const remove = removeMember.bind(null, slug, m.user.id);
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[3px] border border-[rgba(232,227,216,0.1)] bg-panel px-4 py-3"
            >
              <span className="text-[13px] text-[#e8e3d8]">{m.user.name}</span>
              <span className="font-mono text-[11px] text-[#5e7370]">{m.user.email}</span>
              {!m.user.active && (
                <span className="font-mono text-[9.5px] uppercase text-danger">inactivo</span>
              )}
              <span className="flex-1" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">
                {PROJECT_ROLE_LABEL[r]}
              </span>
              {isOwner && r !== "OWNER" && (
                <form action={remove}>
                  <button type="submit" className="btn btn-danger">
                    Quitar
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <form action={invite} className="panel mt-6 flex flex-col gap-3">
          <h3 className="kicker">Agregar miembro</h3>
          <p className="hint -mt-1">
            La persona debe existir ya como usuario de la plataforma. Los crea el
            administrador en Administracion.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              name="email"
              type="email"
              required
              className="field flex-1"
              placeholder="correo@voltac.com.co"
            />
            <select name="role" className="field w-40" defaultValue="EDITOR">
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Lector</option>
              <option value="OWNER">Responsable</option>
            </select>
            <button type="submit" className="btn btn-primary">
              Agregar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
