import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createUser, resetUserPassword, setUserActive } from "@/app/actions/projects";

export const metadata = { title: "Usuarios — Voltac Innovacion" };

export default async function UsersPage() {
  const admin = await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    include: { _count: { select: { memberships: true } } },
  });

  return (
    <div className="max-w-[860px] pt-8 pb-16">
      <p className="kicker mb-2">Administracion</p>
      <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">
        Usuarios de la instancia
      </h1>
      <p className="hint mt-3 max-w-[70ch]">
        No hay registro abierto: las cuentas se crean aqui. Al crear una, entrega la
        contraseña por un canal seguro y pidele a la persona que la cambie contigo. Cambiar o
        desactivar una cuenta cierra sus sesiones abiertas de inmediato.
      </p>

      <form action={createUser} className="panel mt-7 flex flex-col gap-3">
        <h2 className="kicker">Crear usuario</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="name" required className="field" placeholder="Nombre completo" />
          <input
            name="email"
            type="email"
            required
            className="field"
            placeholder="correo@voltac.com.co"
          />
          <input
            name="password"
            type="text"
            required
            minLength={8}
            className="field"
            placeholder="Contraseña inicial (min. 8 caracteres)"
          />
          <select name="role" className="field" defaultValue="MEMBER">
            <option value="MEMBER">Miembro</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary self-start">
          Crear
        </button>
      </form>

      <ul className="mt-7 flex flex-col gap-2">
        {users.map((u) => {
          const toggle = setUserActive.bind(null, u.id, !u.active);
          const reset = resetUserPassword.bind(null, u.id);
          return (
            <li
              key={u.id}
              className="rounded-[3px] border border-[rgba(232,227,216,0.1)] bg-panel px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="text-[13px] text-[#e8e3d8]">{u.name}</span>
                <span className="font-mono text-[11px] text-[#5e7370]">{u.email}</span>
                {u.role === "ADMIN" && (
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent">
                    admin
                  </span>
                )}
                {!u.active && (
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-danger">
                    inactivo
                  </span>
                )}
                <span className="flex-1" />
                <span className="font-mono text-[10px] text-[#4d5a58]">
                  {u._count.memberships} proyecto{u._count.memberships === 1 ? "" : "s"}
                </span>
                {u.id !== admin.id && (
                  <form action={toggle}>
                    <button type="submit" className={`btn ${u.active ? "btn-danger" : ""}`}>
                      {u.active ? "Desactivar" : "Reactivar"}
                    </button>
                  </form>
                )}
              </div>

              <form action={reset} className="mt-2.5 flex gap-2">
                <input
                  name="password"
                  type="text"
                  minLength={8}
                  className="field flex-1 text-[12px]"
                  placeholder="Nueva contraseña para esta cuenta"
                />
                <button type="submit" className="btn">
                  Restablecer
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
