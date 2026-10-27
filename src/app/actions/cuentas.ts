"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, hashPassword, hashSesionActual, requireAdmin, requireUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { correoActivacion, correoConfigurado, correoInvitacion, correoRestablecer } from "@/lib/correo";
import { guardarFoto } from "@/lib/fotos";
import {
  HORAS_ACTIVACION,
  HORAS_INVITACION,
  MINUTOS_RESTABLECER,
  hashToken,
  ipCliente,
  nuevoToken,
  permitir,
  problemaConClave,
  urlBase,
} from "@/lib/seguridad";

/**
 * Ciclo de vida de una cuenta:
 *
 *   1. Un administrador invita un correo. No hay registro abierto, así que
 *      nadie puede crear cuentas en masa desde afuera.
 *   2. La persona abre el enlace, arma su perfil (nombre, cargo, formación y
 *      foto) y elige su contraseña.
 *   3. Le llega un enlace de activación; al abrirlo confirma que el correo es
 *      suyo y ya puede entrar.
 *
 * Los administradores no se crean desde la web: solo desde la terminal del
 * servidor (scripts/superusuario.mts).
 *
 * Todas devuelven el resultado en vez de lanzar, porque en producción Next
 * oculta el mensaje de las excepciones. Cuando el correo no está configurado
 * devuelven el enlace para que el administrador lo entregue a mano.
 */

export type EstadoCuenta = { ok: boolean; mensaje: string; enlace?: string };

const NADA: EstadoCuenta = { ok: false, mensaje: "" };
const texto = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max);
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;

/** El enlace solo se muestra en pantalla si no salió por correo. */
function conEnlace(enviado: boolean, enlace: string, siEnvia: string, siNo: string): EstadoCuenta {
  return enviado ? { ok: true, mensaje: siEnvia } : { ok: true, mensaje: siNo, enlace };
}

async function crearTokenCuenta(userId: string, tipo: "ACTIVACION" | "RESTABLECER") {
  // Un enlace vigente por tipo: pedir otro anula el anterior.
  await prisma.tokenCuenta.updateMany({ where: { userId, tipo, usadoAt: null }, data: { usadoAt: new Date() } });
  const { token, hash } = nuevoToken();
  const vence = tipo === "ACTIVACION" ? HORAS_ACTIVACION * 3_600_000 : MINUTOS_RESTABLECER * 60_000;
  await prisma.tokenCuenta.create({ data: { userId, tipo, tokenHash: hash, expiresAt: new Date(Date.now() + vence) } });
  return `${await urlBase()}/${tipo === "ACTIVACION" ? "activar" : "restablecer"}/${token}`;
}

async function tokenVigente(token: string, tipo: "ACTIVACION" | "RESTABLECER") {
  const t = await prisma.tokenCuenta.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!t || t.tipo !== tipo || t.usadoAt || t.expiresAt < new Date()) return null;
  return t;
}

// ─── 1. Invitar (administrador) ──────────────────────────────────────────────

export async function invitar(_prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  const admin = await requireAdmin();
  const email = texto(fd, "email", 200).toLowerCase();
  const nombre = texto(fd, "nombre", 120);
  if (!emailValido(email)) return { ok: false, mensaje: "Escribe un correo válido." };

  const existe = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existe) return { ok: false, mensaje: `Ya hay una cuenta con ${email}.` };

  await prisma.invitacion.updateMany({ where: { email, aceptadaAt: null, revocadaAt: null }, data: { revocadaAt: new Date() } });
  const { token, hash } = nuevoToken();
  await prisma.invitacion.create({
    data: { email, nombre, role: "MEMBER", tokenHash: hash, expiresAt: new Date(Date.now() + HORAS_INVITACION * 3_600_000), invitadoPorId: admin.id },
  });
  const enlace = `${await urlBase()}/invitacion/${token}`;
  const enviado = await correoInvitacion(email, nombre, admin.name, enlace);
  revalidatePath("/admin/usuarios");
  return conEnlace(
    enviado,
    enlace,
    `Invitación enviada a ${email}. Vence en ${HORAS_INVITACION} horas.`,
    `El correo no está configurado: entrega este enlace a ${email} por un canal seguro. Vence en ${HORAS_INVITACION} horas y sirve una vez.`,
  );
}

export async function revocarInvitacion(id: string): Promise<void> {
  await requireAdmin();
  await prisma.invitacion.updateMany({ where: { id, aceptadaAt: null }, data: { revocadaAt: new Date() } });
  revalidatePath("/admin/usuarios");
}

/** Reenvía una invitación pendiente con un enlace nuevo (el anterior deja de servir). */
export async function reenviarInvitacion(_prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  const admin = await requireAdmin();
  const id = texto(fd, "id", 60);
  const inv = await prisma.invitacion.findUnique({ where: { id } });
  if (!inv || inv.aceptadaAt) return { ok: false, mensaje: "Esa invitación ya no está pendiente." };
  const { token, hash } = nuevoToken();
  await prisma.invitacion.update({
    where: { id },
    data: { tokenHash: hash, revocadaAt: null, expiresAt: new Date(Date.now() + HORAS_INVITACION * 3_600_000) },
  });
  const enlace = `${await urlBase()}/invitacion/${token}`;
  const enviado = await correoInvitacion(inv.email, inv.nombre, admin.name, enlace);
  revalidatePath("/admin/usuarios");
  return conEnlace(enviado, enlace, `Invitación reenviada a ${inv.email}.`, `Entrega este enlace nuevo a ${inv.email}:`);
}

// ─── 2. Aceptar la invitación: perfil, foto y contraseña ────────────────────

export async function aceptarInvitacion(token: string, _prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  if (!permitir(`invitacion:${await ipCliente()}`, 10, 15 * 60_000)) return { ok: false, mensaje: "Demasiados intentos. Espera unos minutos." };

  const inv = await prisma.invitacion.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!inv || inv.aceptadaAt || inv.revocadaAt || inv.expiresAt < new Date()) {
    return { ok: false, mensaje: "La invitación venció o ya se usó. Pide una nueva al administrador." };
  }
  if (await prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } })) {
    return { ok: false, mensaje: "Ya existe una cuenta con este correo. Inicia sesión." };
  }

  const nombre = texto(fd, "nombre", 120);
  const cargo = texto(fd, "cargo", 120);
  const formacion = texto(fd, "formacion", 600);
  const clave = String(fd.get("clave") ?? "");
  const foto = fd.get("foto");
  if (!nombre || !cargo) return { ok: false, mensaje: "Tu nombre y tu rol en el equipo son obligatorios." };
  if (!(foto instanceof File) || foto.size === 0) return { ok: false, mensaje: "Sube una foto de perfil: aparece en la presentación del equipo." };
  if (clave !== String(fd.get("clave2") ?? "")) return { ok: false, mensaje: "Las dos contraseñas no coinciden." };
  const problema = problemaConClave(clave, inv.email, nombre);
  if (problema) return { ok: false, mensaje: problema };

  const user = await prisma.user.create({
    data: { email: inv.email, name: nombre, cargo, formacion, role: inv.role === "ADMIN" ? "ADMIN" : "MEMBER", passwordHash: await hashPassword(clave), claveCambiadaAt: new Date() },
  });
  const f = await guardarFoto(user.id, foto, "");
  if (!f.ok) {
    await prisma.user.delete({ where: { id: user.id } });
    return { ok: false, mensaje: f.error };
  }
  await prisma.user.update({ where: { id: user.id }, data: { foto: f.nombre } });
  await prisma.invitacion.update({ where: { id: inv.id }, data: { aceptadaAt: new Date() } });

  const enlace = await crearTokenCuenta(user.id, "ACTIVACION");
  const enviado = await correoActivacion(user.email, nombre, enlace);
  if (enviado) return { ok: true, mensaje: `Listo. Te enviamos un enlace de activación a ${user.email}: ábrelo para entrar.` };
  // Sin correo configurado, en desarrollo se muestra el enlace; en producción lo entrega el administrador.
  return process.env.NODE_ENV === "production"
    ? { ok: true, mensaje: "Tu perfil quedó creado. Pide al administrador tu enlace de activación." }
    : { ok: true, mensaje: "Perfil creado. El correo no está configurado en este entorno; este es tu enlace de activación:", enlace };
}

// ─── 3. Activar la cuenta ────────────────────────────────────────────────────

export async function activarCuenta(token: string): Promise<EstadoCuenta> {
  if (!permitir(`activar:${await ipCliente()}`, 20, 15 * 60_000)) return { ok: false, mensaje: "Demasiados intentos. Espera unos minutos." };
  const t = await tokenVigente(token, "ACTIVACION");
  if (!t) return { ok: false, mensaje: "El enlace de activación venció o ya se usó. Pide uno nuevo al administrador." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: t.userId }, data: { emailVerificadoAt: new Date() } }),
    prisma.tokenCuenta.update({ where: { id: t.id }, data: { usadoAt: new Date() } }),
  ]);
  return { ok: true, mensaje: "Tu cuenta quedó activa. Ya puedes iniciar sesión." };
}

/** El administrador genera un enlace de activación nuevo para quien no lo recibió. */
export async function reenviarActivacion(_prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  await requireAdmin();
  const u = await prisma.user.findUnique({ where: { id: texto(fd, "id", 60) } });
  if (!u || u.emailVerificadoAt) return { ok: false, mensaje: "Esa cuenta ya está activa." };
  const enlace = await crearTokenCuenta(u.id, "ACTIVACION");
  const enviado = await correoActivacion(u.email, u.name, enlace);
  return conEnlace(enviado, enlace, `Enlace de activación enviado a ${u.email}.`, `Entrega este enlace de activación a ${u.email}:`);
}

// ─── Recuperar la contraseña ─────────────────────────────────────────────────

const RESPUESTA_GENERICA = "Si el correo tiene una cuenta activa, te llegará un enlace para restablecer la contraseña. Revisa también el spam.";

export async function solicitarRestablecer(_prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  const email = texto(fd, "email", 200).toLowerCase();
  if (!permitir(`recuperar:${await ipCliente()}`, 5, 15 * 60_000) || !permitir(`recuperar:${email}`, 3, 60 * 60_000)) {
    return { ok: false, mensaje: "Demasiadas solicitudes. Espera un rato e inténtalo de nuevo." };
  }
  const u = emailValido(email) ? await prisma.user.findUnique({ where: { email } }) : null;
  // La respuesta es la misma exista o no la cuenta: no se revela quién está registrado.
  if (u && u.active && u.emailVerificadoAt) {
    const enlace = await crearTokenCuenta(u.id, "RESTABLECER");
    await correoRestablecer(u.email, u.name, enlace);
  }
  return { ok: true, mensaje: RESPUESTA_GENERICA };
}

/** El administrador genera el enlace de restablecimiento de otra persona. */
export async function enviarRestablecer(_prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  await requireAdmin();
  const u = await prisma.user.findUnique({ where: { id: texto(fd, "id", 60) } });
  if (!u) return { ok: false, mensaje: "Ese usuario ya no existe." };
  const enlace = await crearTokenCuenta(u.id, "RESTABLECER");
  const enviado = await correoRestablecer(u.email, u.name, enlace);
  return conEnlace(enviado, enlace, `Enlace para restablecer la contraseña enviado a ${u.email}.`, `Entrega este enlace a ${u.email} (vence en ${MINUTOS_RESTABLECER} minutos):`);
}

export async function restablecerClave(token: string, _prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  if (!permitir(`restablecer:${await ipCliente()}`, 10, 15 * 60_000)) return { ok: false, mensaje: "Demasiados intentos. Espera unos minutos." };
  const t = await tokenVigente(token, "RESTABLECER");
  if (!t) return { ok: false, mensaje: "El enlace venció o ya se usó. Pide uno nuevo." };
  const clave = String(fd.get("clave") ?? "");
  if (clave !== String(fd.get("clave2") ?? "")) return { ok: false, mensaje: "Las dos contraseñas no coinciden." };
  const problema = problemaConClave(clave, t.user.email, t.user.name);
  if (problema) return { ok: false, mensaje: problema };
  await prisma.$transaction([
    prisma.user.update({
      where: { id: t.userId },
      // Abrir el enlace también prueba que el correo es suyo.
      data: { passwordHash: await hashPassword(clave), claveCambiadaAt: new Date(), intentosFallidos: 0, bloqueadoHasta: null, emailVerificadoAt: t.user.emailVerificadoAt ?? new Date() },
    }),
    prisma.tokenCuenta.update({ where: { id: t.id }, data: { usadoAt: new Date() } }),
    // Con la contraseña nueva, toda sesión abierta muere.
    prisma.session.deleteMany({ where: { userId: t.userId } }),
  ]);
  return { ok: true, mensaje: "Tu contraseña quedó cambiada. Inicia sesión con la nueva." };
}

// ─── Perfil propio ───────────────────────────────────────────────────────────

export async function guardarPerfil(_prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  const yo = await getSessionUser();
  if (!yo) return NADA;
  const u = await prisma.user.findUnique({ where: { id: yo.id } });
  if (!u) return NADA;
  const nombre = texto(fd, "nombre", 120);
  const cargo = texto(fd, "cargo", 120);
  const formacion = texto(fd, "formacion", 600);
  if (!nombre || !cargo) return { ok: false, mensaje: "Tu nombre y tu rol en el equipo son obligatorios." };
  let foto = u.foto;
  const archivo = fd.get("foto");
  if (archivo instanceof File && archivo.size > 0) {
    const f = await guardarFoto(u.id, archivo, u.foto);
    if (!f.ok) return { ok: false, mensaje: f.error };
    foto = f.nombre;
  }
  if (!foto) return { ok: false, mensaje: "Sube una foto de perfil: aparece en la presentación del equipo." };
  await prisma.user.update({ where: { id: u.id }, data: { name: nombre, cargo, formacion, foto } });
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Perfil guardado." };
}

export async function cambiarClave(_prev: EstadoCuenta, fd: FormData): Promise<EstadoCuenta> {
  const yo = await requireUser();
  if (!permitir(`cambiar-clave:${yo.id}`, 5, 15 * 60_000)) return { ok: false, mensaje: "Demasiados intentos. Espera unos minutos." };
  const u = await prisma.user.findUnique({ where: { id: yo.id } });
  if (!u || !(await verifyPassword(String(fd.get("actual") ?? ""), u.passwordHash))) return { ok: false, mensaje: "La contraseña actual no es correcta." };
  const clave = String(fd.get("clave") ?? "");
  if (clave !== String(fd.get("clave2") ?? "")) return { ok: false, mensaje: "Las dos contraseñas nuevas no coinciden." };
  const problema = problemaConClave(clave, u.email, u.name);
  if (problema) return { ok: false, mensaje: problema };
  const propia = await hashSesionActual();
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(clave), claveCambiadaAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: u.id, ...(propia ? { token: { not: propia } } : {}) } });
  return { ok: true, mensaje: "Contraseña cambiada. Las demás sesiones abiertas se cerraron." };
}

export async function correoListo(): Promise<boolean> {
  await requireAdmin();
  return correoConfigurado();
}
