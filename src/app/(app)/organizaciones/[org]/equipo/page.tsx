import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/organizaciones";
import { canAdminProject, PROJECT_ROLES, PROJECT_ROLE_LABEL, asEnum } from "@/lib/enums";
import { agregarMiembroOrg, quitarMiembroOrg } from "@/app/actions/organizaciones";
import { Avisos } from "@/components/v2/ui";

export default async function OrgEquipoPage({
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
  const esResponsable = canAdminProject(role);
  const miembros = await prisma.orgMembership.findMany({
    where: { organizacionId: org.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mt-8 max-w-[720px]">
      <Avisos hecho={hecho} error={error} />
      <h2 className="kicker mb-2">Equipo</h2>
      <p className="hint mb-5">
        Al crear un reto, este equipo pasa al proyecto.
      </p>
      <ul className="flex flex-col gap-2">
        {miembros.map((m) => {
          const r = asEnum(PROJECT_ROLES, m.role, "VIEWER");
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[3px] border border-[rgba(232,227,216,0.1)] bg-panel px-4 py-3">
              <span className="text-[13px] text-[#e8e3d8]">{m.user.name}</span>
              <span className="font-mono text-[11px] text-[#5e7370]">{m.user.email}</span>
              <span className="flex-1" />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">{PROJECT_ROLE_LABEL[r]}</span>
              {esResponsable && r !== "OWNER" && (
                <form action={quitarMiembroOrg.bind(null, slug, m.user.id)}>
                  <button className="btn btn-danger">Quitar</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {esResponsable && (
        <form action={agregarMiembroOrg.bind(null, slug)} className="panel mt-6 flex flex-col gap-3">
          <h3 className="kicker">Agregar persona</h3>
          <p className="hint -mt-1">La persona debe tener cuenta en la plataforma (Administración &gt; Usuarios).</p>
          <div className="flex flex-wrap gap-3">
            <input name="email" type="email" required className="field flex-1" placeholder="correo@empresa.com" />
            <select name="role" className="field w-40" defaultValue="EDITOR">
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Lector</option>
              <option value="OWNER">Responsable</option>
            </select>
            <button type="submit" className="btn btn-primary">Agregar</button>
          </div>
        </form>
      )}
    </div>
  );
}
