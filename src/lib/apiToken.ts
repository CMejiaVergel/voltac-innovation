import "server-only";

import crypto from "node:crypto";

import { prisma } from "@/lib/db";
import { asEnum, USER_ROLES, type UserRole } from "@/lib/enums";
import { registrarActividadMcp } from "@/lib/actividad";

/**
 * Autenticacion por token para agentes externos.
 *
 * La usa el servidor MCP para que Claude Code actue como agente investigador
 * contra la misma API guardada que usa la interfaz. Un token NO es una llave
 * maestra: hereda exactamente los permisos del usuario al que pertenece, asi
 * que solo puede tocar los proyectos donde ese usuario es miembro.
 *
 * Y se puede acotar más: un token ligado a un proyecto solo ve ese proyecto, y
 * cada llamada puede declarar con la cabecera X-Voltac-Proyecto el único
 * proyecto en el que trabaja. Así un slug equivocado no escribe en otro reto.
 */

const PREFIX = "vin_";

export type TokenIdentity = {
  tokenId: string;
  readOnly: boolean;
  user: { id: string; email: string; name: string; role: UserRole; soloProyectoId?: string; soloOrganizacionId?: string | null };
};

export function hashToken(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

/** Crea un token. Devuelve el valor en claro, que no se vuelve a poder leer. */
export async function createApiToken(params: {
  userId: string;
  label: string;
  readOnly?: boolean;
  expiresInDays?: number;
  projectId?: string | null;
}): Promise<{ plain: string; prefix: string }> {
  const plain = PREFIX + crypto.randomBytes(32).toString("base64url");
  const prefix = plain.slice(0, PREFIX.length + 8);

  await prisma.apiToken.create({
    data: {
      tokenHash: hashToken(plain),
      prefix,
      label: params.label,
      userId: params.userId,
      readOnly: params.readOnly ?? false,
      projectId: params.projectId ?? null,
      expiresAt: params.expiresInDays
        ? new Date(Date.now() + params.expiresInDays * 86400_000)
        : null,
    },
  });

  return { plain, prefix };
}

/**
 * Resuelve el token de la cabecera Authorization.
 *
 * Devuelve null si falta, no existe, esta revocado, vencido, o su usuario esta
 * inactivo. Nunca lanza: quien llama decide el codigo de respuesta.
 */
export async function identifyRequest(request: Request): Promise<TokenIdentity | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(match[1].trim()) },
    include: { user: true, project: { select: { id: true, slug: true, organizacionId: true } } },
  });

  if (!token) return null;
  if (token.revokedAt) return null;
  if (token.expiresAt && token.expiresAt < new Date()) return null;
  if (!token.user.active) return null;

  // Marca de uso, util para detectar tokens olvidados. Sin await: no debe
  // retrasar la respuesta ni tumbarla si falla.
  void prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  // El proyecto de la llamada: el del token, o el que declara la cabecera. Si
  // los dos existen y no coinciden, la llamada no ve ningún proyecto.
  let solo: { id: string; organizacionId: string | null } | null = token.project;
  const pedido = request.headers.get("x-voltac-proyecto")?.trim();
  if (pedido) {
    if (token.project && token.project.slug !== pedido) solo = { id: "-", organizacionId: null };
    else if (!token.project) {
      const p = await prisma.project.findUnique({ where: { slug: pedido }, select: { id: true, organizacionId: true } });
      solo = p ?? { id: "-", organizacionId: null };
    }
  }
  registrarActividadMcp(token.user.id, solo && solo.id !== "-" ? solo.id : null);

  return {
    tokenId: token.id,
    readOnly: token.readOnly,
    user: {
      id: token.user.id,
      email: token.user.email,
      name: token.user.name,
      role: asEnum(USER_ROLES, token.user.role, "MEMBER"),
      ...(solo ? { soloProyectoId: solo.id, soloOrganizacionId: solo.organizacionId } : {}),
    },
  };
}
