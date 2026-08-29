import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { asEnum, USER_ROLES, type UserRole } from "@/lib/enums";

/**
 * Sesiones propias, sin dependencia de terceros.
 *
 * El token va en una cookie httpOnly y ademas se guarda hasheado en base de
 * datos: si alguien se lleva una copia del archivo SQLite, no obtiene cookies
 * validas. La cookie lleva el token en claro; la tabla guarda solo su SHA-256.
 */

const COOKIE_NAME = "voltac_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Crea la sesion y deja la cookie puesta. Devuelve el usuario autenticado. */
export async function createSession(userId: string, userAgent?: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { token: hashToken(token), userId, userAgent: userAgent?.slice(0, 300), expiresAt },
  });

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token: hashToken(token) } });
  }
  jar.delete(COOKIE_NAME);
}

/** Usuario de la peticion actual, o null. No redirige. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: asEnum(USER_ROLES, session.user.role, "MEMBER"),
  };
}

/** Usuario de la peticion actual. Redirige a /login si no hay sesion. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/proyectos");
  return user;
}

/** Autentica por email y contraseña. Devuelve el id del usuario o null. */
export async function authenticate(email: string, password: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  // Se compara igual aunque el usuario no exista, para no filtrar por tiempo
  // de respuesta cuales correos estan registrados.
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const ok = await verifyPassword(password, hash);

  if (!user || !user.active || !ok) return null;
  return user.id;
}

/** Limpia sesiones vencidas. Se llama de forma oportunista en el login. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
