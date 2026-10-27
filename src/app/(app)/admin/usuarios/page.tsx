import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { correoConfigurado } from "@/lib/correo";
import { setUserActive, setPermisoClaveInstancia } from "@/app/actions/projects";
import { revocarInvitacion } from "@/app/actions/cuentas";
import { AccionConEnlace, FormInvitar } from "@/components/cuentas/Formularios";
import { enLinea } from "@/lib/actividad";

export const metadata = { title: "Usuarios — Voltac Innovacion" };
export const dynamic = "force-dynamic";

const fecha = (d: Date | null) => (d ? d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" }) : "—");
const ZONA = "America/Bogota";
const hora = (d: Date | null) =>
  d ? d.toLocaleString("es-CO", { timeZone: ZONA, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const soloHora = (d: Date) => d.toLocaleTimeString("es-CO", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });

/** «hace 5 min», «hace 3 h», o la fecha si pasó más de un día. */
function hace(d: Date | null, ahora: number) {
  if (!d) return "sin registro todavía";
  const min = Math.round((ahora - d.getTime()) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  if (min < 24 * 60) return `hace ${Math.round(min / 60)} h`;
  return hora(d);
}

const ETAPAS: Record<string, string> = {
  "": "Vista general",
  configurar: "Configurar",
  divergir: "Divergir",
  plataformas: "Plataformas",
  combinar: "Combinar",
  convergir: "Convergir",
  actuar: "Actuar",
  equipo: "Equipo",
  ajustes: "Ajustes",
};
const etapa = (a: { etapa: string; via: string }) => (a.via === "MCP" ? "Claude (MCP)" : (ETAPAS[a.etapa] ?? a.etapa));

function duracion(desde: Date, hasta: Date) {
  const min = Math.round((hasta.getTime() - desde.getTime()) / 60_000);
  return min < 1 ? "menos de 1 min" : min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ hecho?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { hecho, error } = await searchParams;

  const [users, invitaciones, accesos] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
      include: { _count: { select: { memberships: true } } },
    }),
    prisma.invitacion.findMany({
      where: { aceptadaAt: null, revocadaAt: null },
      orderBy: { createdAt: "desc" },
      include: { invitadoPor: { select: { name: true } } },
    }),
    prisma.accesoProyecto.findMany({
      where: { hasta: { gte: new Date(Date.now() - 30 * 86400_000) } },
      orderBy: { hasta: "desc" },
      take: 1500,
      include: { project: { select: { name: true, slug: true } } },
    }),
  ]);
  const ahora = Date.now();
  const porUsuario = new Map<string, typeof accesos>();
  for (const a of accesos) {
    const l = porUsuario.get(a.userId) ?? [];
    if (l.length < 15) l.push(a);
    porUsuario.set(a.userId, l);
  }
  const conectados = users.filter((u) => enLinea(u.ultimaActividadAt, ahora)).length;
  const smtp = correoConfigurado();

  return (
    <div className="pb-16 pt-6">
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

      <h2 className="kicker mb-2 mt-7">
        Cuentas · {conectados} en línea ahora
      </h2>
      <ul className="flex flex-col gap-2">
        {users.map((u) => {
          const toggle = setUserActive.bind(null, u.id, !u.active);
          const permiso = setPermisoClaveInstancia.bind(null, u.id, !u.usaClaveInstancia);
          const recientes = porUsuario.get(u.id) ?? [];
          const enLineaAhora = enLinea(u.ultimaActividadAt, ahora);
          const ultimo = recientes[0];
          const ahoraEn = enLineaAhora && ultimo && enLinea(ultimo.hasta, ahora) ? ultimo : null;
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
                  {u._count.memberships} proyecto{u._count.memberships === 1 ? "" : "s"}
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
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#8b9a97]">
                {enLineaAhora ? (
                  <span className="flex items-center gap-1.5 font-semibold text-[#7fd39b]">
                    <span className="h-2 w-2 rounded-full bg-[#7fd39b]" aria-hidden />
                    En línea
                    {ahoraEn && (
                      <span className="font-normal text-[#c9d1cf]">
                        · {ahoraEn.project.name} · {etapa(ahoraEn)}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#4d5a58]" aria-hidden />
                    Última actividad {hace(u.ultimaActividadAt, ahora)}
                  </span>
                )}
                <span>Último inicio de sesión: {hora(u.ultimoIngreso)}</span>
              </div>
              {recientes.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11.5px] text-accent">Actividad reciente ({recientes.length})</summary>
                  <table className="mt-2 w-full text-left text-[11.5px]">
                    <thead className="text-[#5e7370]">
                      <tr>
                        <th className="py-1 pr-3 font-normal">Proyecto</th>
                        <th className="py-1 pr-3 font-normal">Dónde</th>
                        <th className="py-1 pr-3 font-normal">Cuándo (hora de Colombia)</th>
                        <th className="py-1 font-normal">Tiempo</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#c9d1cf]">
                      {recientes.map((a) => (
                        <tr key={a.id} className="border-t border-[rgba(232,227,216,0.06)]">
                          <td className="py-1 pr-3">{a.project.name}</td>
                          <td className="py-1 pr-3">{etapa(a)}</td>
                          <td className="py-1 pr-3 font-mono text-[10.5px]">
                            {hora(a.desde)} – {soloHora(a.hasta)}
                          </td>
                          <td className="py-1 font-mono text-[10.5px]">{duracion(a.desde, a.hasta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
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
