import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { asEnum, USER_ROLES, type UserRole } from "@/lib/enums";
import { INTENTOS_ANTES_DE_BLOQUEO, MINUTOS_BLOQUEO } from "@/lib/seguridad";

/**
 * Sesiones propias, sin dependencia de terceros.
 *
 * El token va en una cookie httpOnly y ademas se guarda hasheado en base de
 * datos: si alguien se lleva una copia del archivo SQLite, no obtiene cookies
 * validas. La cookie lleva el token en claro; la tabla guarda solo su SHA-256.
 */

const COOKIE_NAME = "voltac_session";
const SESSION_DAYS = 14;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Tiene foto y cargo: el perfil del equipo está completo. */
  perfilCompleto?: boolean;
  /**
   * Solo en llamadas del MCP: el único proyecto (y su organización) que esta
   * llamada puede tocar. Lo fija el token o la cabecera X-Voltac-Proyecto.
   */
  soloProyectoId?: string;
  soloOrganizacionId?: string | null;
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

/**
 * Hash del token de la peticion actual, o null si no hay cookie.
 *
 * Sirve para cerrar «todas las sesiones menos esta»: al restablecer una
 * contraseña hay que matar las cookies viejas, pero si quien la restablece es
 * el propio dueño de la cuenta, matar tambien la suya lo expulsa a mitad de la
 * accion y la pantalla se queda en negro.
 */
export async function hashSesionActual(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token ? hashToken(token) : null;
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

  if (!session || session.expiresAt < new Date() || !session.user.active || !session.user.emailVerificadoAt) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: asEnum(USER_ROLES, session.user.role, "MEMBER"),
    perfilCompleto: Boolean(session.user.foto && session.user.cargo),
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

export type ResultadoAutenticar = { ok: true; userId: string } | { ok: false; motivo: "CREDENCIALES" | "SIN_ACTIVAR" };

/**
 * Autentica por email y contraseña.
 *
 * Tras INTENTOS_ANTES_DE_BLOQUEO intentos fallidos seguidos la cuenta se bloquea
 * MINUTOS_BLOQUEO minutos. El error es siempre el mismo —credenciales— para no
 * revelar qué correos existen ni si una cuenta está bloqueada; solo quien
 * acierta la contraseña se entera de que le falta activar la cuenta.
 */
export async function authenticate(email: string, password: string): Promise<ResultadoAutenticar> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });

  // Se compara igual aunque el usuario no exista, para no filtrar por tiempo
  // de respuesta cuales correos estan registrados.
  const hash = user?.passwordHash || "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
  const ok = await verifyPassword(password, hash);

  if (!user || !user.active) return { ok: false, motivo: "CREDENCIALES" };
  if (user.bloqueadoHasta && user.bloqueadoHasta > new Date()) return { ok: false, motivo: "CREDENCIALES" };

  if (!ok) {
    const intentos = user.intentosFallidos + 1;
    await prisma.user.update({
      where: { id: user.id },
      data:
        intentos >= INTENTOS_ANTES_DE_BLOQUEO
          ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60_000) }
          : { intentosFallidos: intentos },
    });
    return { ok: false, motivo: "CREDENCIALES" };
  }

  if (!user.emailVerificadoAt) return { ok: false, motivo: "SIN_ACTIVAR" };
  await prisma.user.update({ where: { id: user.id }, data: { intentosFallidos: 0, bloqueadoHasta: null, ultimoIngreso: new Date() } });
  return { ok: true, userId: user.id };
}

/** Limpia sesiones vencidas. Se llama de forma oportunista en el login. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
