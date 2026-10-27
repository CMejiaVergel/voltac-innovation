import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { correoConfigurado } from "@/lib/correo";
import { setUserActive, setPermisoClaveInstancia } from "@/app/actions/projects";
import { revocarInvitacion } from "@/app/actions/cuentas";
import { AccionConEnlace, FormInvitar } from "@/components/cuentas/Formularios";

export const metadata = { title: "Usuarios — Voltac Innovacion" };
export const dynamic = "force-dynamic";

const fecha = (d: Date | null) => (d ? d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ hecho?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { hecho, error } = await searchParams;

  const [users, invitaciones] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      include: { _count: { select: { memberships: true } } },
    }),
    prisma.invitacion.findMany({
      where: { aceptadaAt: null, revocadaAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitadoPor: { select: { name: true } } },
    }),
  ]);
  const smtp = correoConfigurado();

  return (
    <div className="max-w-[860px] pt-8 pb-16">
      <p className="kicker mb-2">Administracion</p>
      <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">Usuarios de la instancia</h1>
      <p className="hint mt-3 max-w-[70ch]">
        El acceso es por invitación: la persona recibe un enlace, crea su perfil con foto y su contraseña, y activa la cuenta desde su correo. Nadie más conoce su
        contraseña. Desactivar una cuenta cierra sus sesiones de inmediato.
      </p>

      {!smtp && (
        <p className="mt-5 rounded-[4px] border border-[rgba(201,169,78,0.5)] bg-[rgba(201,169,78,0.1)] p-3 text-[12.5px] leading-relaxed text-[#e3c97a]">
          El correo saliente no está configurado (SMTP). Mientras tanto, cada invitación o enlace se muestra aquí para que lo entregues tú por un canal seguro.
        </p>
      )}
      {hecho && <p className="mt-5 rounded-[4px] border border-[rgba(111,191,178,0.45)] bg-[rgba(111,191,178,0.1)] p-3 text-[12.5px] text-accent">{hecho}</p>}
      {error && <p className="mt-5 rounded-[4px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] p-3 text-[12.5px] text-[#e8a99c]">{error}</p>}

      <section className="panel mt-7">
        <h2 className="kicker mb-3">Invitar a una persona</h2>
        <FormInvitar />
      </section>

      {invitaciones.length > 0 && (
        <section className="mt-7">
          <h2 className="kicker mb-2">Invitaciones pendientes</h2>
          <ul className="flex flex-col gap-2">
            {invitaciones.map((i) => {
              const vencida = i.expiresAt < new Date();
              return (
                <li key={i.id} className="rounded-[3px] border border-[rgba(232,227,216,0.1)] bg-panel px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-[13px] text-[#e8e3d8]">{i.nombre || "Sin nombre"}</span>
                    <span className="font-mono text-[11px] text-[#5e7370]">{i.email}</span>
                    <span className={`font-mono text-[9.5px] uppercase tracking-[0.12em] ${vencida ? "text-danger" : "text-[#c9a94e]"}`}>
                      {vencida ? "vencida" : `vence ${fecha(i.expiresAt)}`}
                    </span>
                    <span className="flex-1" />
                    <span className="text-[11px] text-[#5e7370]">invitó {i.invitadoPor?.name ?? "—"}</span>
                    <form action={revocarInvitacion.bind(null, i.id)}>
                      <button type="submit" className="btn btn-danger">
                        Revocar
                      </button>
                    </form>
                  </div>
                  <AccionConEnlace id={i.id} tipo="INVITACION" />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 className="kicker mb-2 mt-7">Cuentas</h2>
      <ul className="flex flex-col gap-2">
        {users.map((u) => {
          const toggle = setUserActive.bind(null, u.id, !u.active);
          const permiso = setPermisoClaveInstancia.bind(null, u.id, !u.usaClaveInstancia);
          return (
            <li key={u.id} className="rounded-[3px] border border-[rgba(232,227,216,0.1)] bg-panel px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {u.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/foto/${u.id}?v=${u.foto}`} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[rgba(232,227,216,0.08)] text-[10px] text-[#7f8f8c]">—</span>
                )}
                <span className="text-[13px] text-[#e8e3d8]">
                  {u.name}
                  {u.cargo && <span className="ml-2 text-[11.5px] text-[#8b9a97]">{u.cargo}</span>}
                </span>
                <span className="font-mono text-[11px] text-[#5e7370]">{u.email}</span>
                {u.role === "ADMIN" && <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent">admin</span>}
                {!u.active && <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-danger">inactivo</span>}
                {!u.emailVerificadoAt && <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#c9a94e]">sin activar</span>}
                {u.bloqueadoHasta && u.bloqueadoHasta > new Date() && (
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-danger">bloqueada por intentos</span>
                )}
                {u.openrouterKey ? (
                  <span title="Tiene su propia clave de OpenRouter: gasta sus creditos." className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent">
                    clave propia {u.openrouterHint}
                  </span>
                ) : u.usaClaveInstancia ? (
                  <span title="Sin clave propia, pero puede gastar la del servidor." className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#c9a94e]">
                    usa la del servidor
                  </span>
                ) : (
                  <span title="Sin clave: el agente no correra para esta persona." className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#5e7370]">
                    sin clave
                  </span>
                )}
                <span className="flex-1" />
                <span className="font-mono text-[10px] text-[#4d5a58]">
                  último ingreso {fecha(u.ultimoIngreso)} · {u._count.memberships} proyecto{u._count.memberships === 1 ? "" : "s"}
                </span>
                {u.id !== admin.id && (
                  <>
                    <form action={permiso}>
                      <button type="submit" className="btn" title={u.usaClaveInstancia ? "Dejar de permitirle gastar la clave del servidor." : "Permitirle gastar la clave del servidor en vez de la suya."}>
                        {u.usaClaveInstancia ? "Quitar clave del servidor" : "Dar clave del servidor"}
                      </button>
                    </form>
                    <form action={toggle}>
                      <button type="submit" className={`btn ${u.active ? "btn-danger" : ""}`}>
                        {u.active ? "Desactivar" : "Reactivar"}
                      </button>
                    </form>
                  </>
                )}
              </div>
              {u.id !== admin.id && (
                <div className="mt-2.5">
                  <AccionConEnlace id={u.id} tipo={u.emailVerificadoAt ? "RESTABLECER" : "ACTIVACION"} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
