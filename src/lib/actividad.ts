import "server-only";

import { prisma } from "@/lib/db";

/**
 * Actividad de las personas, para que el superadmin vea quién está en línea,
 * qué proyecto abrió, en qué etapa y de qué hora a qué hora.
 *
 * La interfaz manda una señal por minuto mientras la pestaña está visible
 * (/api/actividad) y el MCP cuenta cada llamada. Cada señal corre `hasta` del
 * tramo abierto; un tramo nuevo empieza al cambiar de proyecto, de etapa o de
 * vía, o tras diez minutos sin señal.
 */

/** Con una señal más reciente que esto, la persona está en línea. */
export const EN_LINEA_MS = 2 * 60_000;
const TRAMO_MS = 10 * 60_000;
const RETENCION_DIAS = 90;

export function enLinea(ultima: Date | null | undefined, ahora = Date.now()): boolean {
  return Boolean(ultima && ahora - ultima.getTime() < EN_LINEA_MS);
}

/** Etapa de una ruta de proyecto: /proyectos/slug/divergir → divergir. */
export function rutaDeProyecto(ruta: string): { slug: string; etapa: string } | null {
  const m = ruta.match(/^\/proyectos\/([^/?#]+)(?:\/([^/?#]+))?/);
  if (!m || m[1] === "nuevo") return null;
  return { slug: decodeURIComponent(m[1]), etapa: m[2] ?? "" };
}

// Las llamadas del MCP llegan en ráfagas: basta con escribir una vez por minuto.
const ultimaEscritura = new Map<string, number>();
function toca(clave: string, cadaMs: number): boolean {
  const ahora = Date.now();
  if (ahora - (ultimaEscritura.get(clave) ?? 0) < cadaMs) return false;
  ultimaEscritura.set(clave, ahora);
  if (ultimaEscritura.size > 5000) ultimaEscritura.clear();
  return true;
}

export async function registrarActividad(userId: string, acceso?: { projectId: string; etapa: string; via: "WEB" | "MCP" }) {
  const ahora = new Date();
  await prisma.user.update({ where: { id: userId }, data: { ultimaActividadAt: ahora } });
  if (!acceso) return;

  const abierto = await prisma.accesoProyecto.findFirst({ where: { userId }, orderBy: { hasta: "desc" } });
  const sigue =
    abierto &&
    abierto.projectId === acceso.projectId &&
    abierto.etapa === acceso.etapa &&
    abierto.via === acceso.via &&
    ahora.getTime() - abierto.hasta.getTime() < TRAMO_MS;
  if (sigue) {
    await prisma.accesoProyecto.update({ where: { id: abierto.id }, data: { hasta: ahora } });
  } else {
    await prisma.accesoProyecto.create({ data: { userId, ...acceso, desde: ahora, hasta: ahora } });
    // De vez en cuando se poda lo viejo, para que la tabla no crezca sin fin.
    if (Math.random() < 0.02) {
      await prisma.accesoProyecto.deleteMany({ where: { hasta: { lt: new Date(Date.now() - RETENCION_DIAS * 86400_000) } } });
    }
  }
}

/** Señal de una llamada del MCP; nunca debe tumbar la llamada. */
export function registrarActividadMcp(userId: string, projectId: string | null) {
  if (!toca(`mcp:${userId}:${projectId ?? ""}`, 60_000)) return;
  void registrarActividad(userId, projectId ? { projectId, etapa: "", via: "MCP" } : undefined).catch(() => {});
}
