import "server-only";

import crypto from "node:crypto";
import { headers } from "next/headers";

/**
 * Piezas de seguridad de las cuentas: tokens de un solo uso, límite de
 * intentos y política de contraseñas.
 *
 * El límite vive en memoria del proceso: la instancia corre en un solo
 * proceso de PM2, así que basta para frenar ráfagas de un mismo origen. El
 * bloqueo por cuenta, en cambio, se guarda en la base (User.bloqueadoHasta)
 * para que sobreviva a un reinicio.
 */

// ─── Tokens de un solo uso ───────────────────────────────────────────────────

/** Token en claro para el enlace, y su hash para la base. */
export function nuevoToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const HORAS_INVITACION = 72;
export const HORAS_ACTIVACION = 48;
export const MINUTOS_RESTABLECER = 60;

// ─── Límite de intentos por origen ───────────────────────────────────────────

const ventanas = new Map<string, number[]>();

/**
 * true si la acción todavía se permite. Cuenta los intentos de la clave en la
 * ventana y descarta los viejos. Una clave típica: «login:<ip>».
 */
export function permitir(clave: string, maximo: number, ventanaMs: number): boolean {
  const ahora = Date.now();
  const lista = (ventanas.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
  if (lista.length >= maximo) {
    ventanas.set(clave, lista);
    return false;
  }
  lista.push(ahora);
  ventanas.set(clave, lista);
  // Limpieza oportunista para que el mapa no crezca sin fin.
  if (ventanas.size > 5000) for (const [k, v] of ventanas) if (!v.some((t) => ahora - t < ventanaMs)) ventanas.delete(k);
  return true;
}

/** IP del cliente detrás de nginx. */
export async function ipCliente(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

// ─── Bloqueo por cuenta ──────────────────────────────────────────────────────

/** Tras tantos intentos fallidos seguidos, la cuenta se bloquea un rato. */
export const INTENTOS_ANTES_DE_BLOQUEO = 5;
export const MINUTOS_BLOQUEO = 15;

// ─── Contraseñas ─────────────────────────────────────────────────────────────

const COMUNES = new Set([
  "123456789012", "contraseña123", "password1234", "qwertyuiop12", "administrador", "voltacvoltac", "innovacion2026", "caribeinnova",
]);

/**
 * Política de contraseñas, al estilo de NIST SP 800-63B: largo antes que
 * reglas de símbolos. Devuelve el problema o null si sirve.
 */
export function problemaConClave(clave: string, email: string, nombre = ""): string | null {
  if (clave.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
  if (clave.length > 128) return "La contraseña no puede pasar de 128 caracteres.";
  const baja = clave.toLowerCase();
  if (COMUNES.has(baja)) return "Esa contraseña es demasiado común.";
  if (/^(.)\1+$/.test(clave)) return "La contraseña no puede ser un solo carácter repetido.";
  const usuario = email.split("@")[0]?.toLowerCase() ?? "";
  if (usuario.length >= 4 && baja.includes(usuario)) return "La contraseña no puede contener tu correo.";
  const primerNombre = nombre.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (primerNombre.length >= 4 && baja.includes(primerNombre)) return "La contraseña no puede contener tu nombre.";
  if (new Set(clave).size < 5) return "La contraseña tiene muy pocos caracteres distintos.";
  return null;
}

/** URL pública de la instancia, para armar los enlaces de los correos. */
export async function urlBase(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
