import { prisma } from "@/lib/db";
import { revocarTokenMcp } from "@/app/actions/tokens";
import { FormTokenMcp } from "@/components/cuentas/FormTokenMcp";

export const metadata = { title: "Conexión con Claude — Voltac Innovacion" };
export const dynamic = "force-dynamic";

const hora = (d: Date | null) =>
  d ? d.toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function ConexionesPage() {
  const [proyectos, tokens] = await Promise.all([
    prisma.project.findMany({ where: { status: "ACTIVE" }, orderBy: { updatedAt: "desc" }, select: { slug: true, name: true } }),
    prisma.apiToken.findMany({
      orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
      include: { user: { select: { name: true } }, project: { select: { name: true } } },
    }),
  ]);
  const ahora = new Date();

  return (
    <div className="pb-16 pt-6">
      <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#e8e3d8]">Conexión con Claude (MCP)</h1>
      <p className="hint mt-3 max-w-[75ch]">
        Un token deja que Claude trabaje en la plataforma con tus permisos de superadmin. Por eso cada token se genera confirmando tu contraseña, se muestra una
        sola vez y queda ligado a un proyecto: aunque Claude se equivoque de slug, no puede tocar otro proyecto. Revócalo cuando la persona termine.
      </p>

      <section className="panel mt-6">
        <h2 className="kicker mb-3">Generar un token</h2>
        <FormTokenMcp proyectos={proyectos} />
      </section>

      <section className="panel mt-6 text-[12.5px] leading-relaxed text-[#c9d1cf]">
        <h2 className="kicker mb-2">Cómo se usa</h2>
        <ol className="lista">
          <li>
            Pega la configuración en el archivo <code>.mcp.json</code> del repositorio de la plataforma y reinicia Claude Code. Con <code>VOLTAC_PROYECTO</code> el
            servidor arranca fijo en ese proyecto.
          </li>
          <li>
            Si el token es de todos los proyectos, Claude no puede cambiar nada hasta elegir uno: pídele «trabaja en el proyecto &lt;slug&gt;» y usará la herramienta{" "}
            <code>trabajar_en_proyecto</code>. Desde ahí, toda llamada va marcada con ese proyecto y la plataforma rechaza cualquier otro.
          </li>
          <li>Para cambiar de proyecto, vuelve a pedírselo: el cambio queda explícito en la conversación.</li>
        </ol>
      </section>

      <h2 className="kicker mb-2 mt-7">Tokens</h2>
      {tokens.length === 0 ? (
        <p className="hint">Aún no hay tokens.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tokens.map((t) => {
            const vencido = t.expiresAt && t.expiresAt < ahora;
            const estado = t.revokedAt ? "revocado" : vencido ? "vencido" : "activo";
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[3px] border border-[rgba(232,227,216,0.1)] bg-panel px-4 py-3">
                <span className="text-[13px] text-[#e8e3d8]">{t.label}</span>
                <span className="font-mono text-[11px] text-[#5e7370]">{t.prefix}…</span>
                <span
                  className={`font-mono text-[9.5px] uppercase tracking-[0.12em] ${estado === "activo" ? "text-accent" : "text-[#5e7370]"}`}
                >
                  {estado}
                </span>
                {t.readOnly && <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#c9a94e]">solo lectura</span>}
                <span className="flex-1" />
                <span className="text-[11.5px] text-[#8b9a97]">
                  {t.project ? `Proyecto: ${t.project.name}` : "Todos los proyectos"} · de {t.user.name}
                </span>
                <span className="w-full font-mono text-[10px] text-[#4d5a58]">
                  creado {hora(t.createdAt)} · vence {hora(t.expiresAt)} · último uso {hora(t.lastUsedAt)}
                </span>
                {estado === "activo" && (
                  <form action={revocarTokenMcp.bind(null, t.id)}>
                    <button type="submit" className="btn btn-danger">
                      Revocar
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
