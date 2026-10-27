"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, verifyPassword } from "@/lib/auth";
import { createApiToken } from "@/lib/apiToken";
import { prisma } from "@/lib/db";
import { permitir, urlBase } from "@/lib/seguridad";

/**
 * Tokens para conectar la plataforma a Claude por MCP. Solo un superadmin los
 * genera, y cada vez confirma su contraseña: el token actúa con sus permisos.
 * El valor en claro se muestra una sola vez; la base guarda solo su hash.
 */

export type EstadoToken = { ok: boolean; mensaje: string; token?: string; proyecto?: string; url?: string };

const DIAS = [7, 30, 90] as const;

export async function crearTokenMcp(_prev: EstadoToken, fd: FormData): Promise<EstadoToken> {
  const admin = await requireAdmin();
  if (!permitir(`token:${admin.id}`, 5, 15 * 60_000)) {
    return { ok: false, mensaje: "Demasiados intentos. Espera unos minutos." };
  }

  const usuario = await prisma.user.findUnique({ where: { id: admin.id }, select: { passwordHash: true } });
  const clave = String(fd.get("clave") ?? "");
  if (!usuario || !clave || !(await verifyPassword(clave, usuario.passwordHash))) {
    return { ok: false, mensaje: "La contraseña no es correcta." };
  }

  const etiqueta = String(fd.get("etiqueta") ?? "").trim().slice(0, 80);
  if (!etiqueta) return { ok: false, mensaje: "Ponle un nombre: quién lo va a usar y para qué." };

  const slug = String(fd.get("proyecto") ?? "");
  const proyecto = slug ? await prisma.project.findUnique({ where: { slug }, select: { id: true, slug: true } }) : null;
  if (slug && !proyecto) return { ok: false, mensaje: "Ese proyecto ya no existe." };

  const dias = Number(fd.get("dias"));
  const { plain } = await createApiToken({
    userId: admin.id,
    label: etiqueta,
    readOnly: fd.get("soloLectura") === "on",
    expiresInDays: (DIAS as readonly number[]).includes(dias) ? dias : 30,
    projectId: proyecto?.id ?? null,
  });
  revalidatePath("/admin/conexiones");
  return {
    ok: true,
    mensaje: "Token creado. Cópialo ahora: no se vuelve a mostrar.",
    token: plain,
    proyecto: proyecto?.slug,
    url: await urlBase(),
  };
}

export async function revocarTokenMcp(id: string): Promise<void> {
  await requireAdmin();
  await prisma.apiToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/admin/conexiones");
}
