import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Cifrado de secretos guardados en la base.
 *
 * Ahora mismo solo lo usa la clave de OpenRouter de cada persona, pero la
 * regla vale para cualquier credencial que llegue despues: en la base va
 * cifrada, y del servidor no sale nunca en claro.
 *
 * Por que cifrar si la base ya esta en el servidor: el respaldo del proyecto
 * se descarga, la copia de dev.db se mueve, y un volcado accidental de la
 * tabla User no puede convertirse en la fuga de la cuenta de OpenRouter de
 * nadie. Es AES-256-GCM, que ademas autentica: si alguien edita el texto
 * cifrado a mano, el descifrado falla en vez de devolver basura.
 *
 * La llave se deriva de SESSION_SECRET, que ya tiene que existir y ya es
 * secreto. Consecuencia que conviene tener presente: si SESSION_SECRET cambia,
 * las claves guardadas dejan de poder leerse y hay que volver a introducirlas.
 * Es el comportamiento correcto —rotar el secreto invalida lo que protegia—
 * pero no debe sorprender a nadie, asi que `descifrar` devuelve null en vez de
 * reventar, y quien llama lo trata como "no hay clave".
 */

const SAL = "voltac-innovacion/secretos/v1";

function llave(): Buffer {
  const secreto = process.env.SESSION_SECRET;
  if (!secreto || secreto.length < 16) {
    throw new Error(
      "Falta SESSION_SECRET (o es demasiado corto) y sin el no se pueden guardar credenciales.",
    );
  }
  return scryptSync(secreto, SAL, 32);
}

/** Devuelve `iv.tag.datos`, todo en base64url. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", llave(), iv);
  const datos = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, datos].map((b) => b.toString("base64url")).join(".");
}

/** null si esta vacio, mal formado, o cifrado con otro SESSION_SECRET. */
export function descifrar(guardado: string): string | null {
  if (!guardado) return null;
  const partes = guardado.split(".");
  if (partes.length !== 3) return null;

  try {
    const [iv, tag, datos] = partes.map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", llave(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(datos), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Pista visible de una clave: suficiente para reconocer cual es, inutil para
 * usarla. La cola importa mas que la cabeza porque el prefijo de OpenRouter
 * (`sk-or-v1-`) es igual en todas.
 */
export function pistaDe(clave: string): string {
  const limpia = clave.trim();
  if (limpia.length <= 8) return "····";
  return `····${limpia.slice(-4)}`;
}

/** Comprobacion de forma, no de validez: eso lo dice OpenRouter al usarla. */
export function pareceClaveOpenRouter(clave: string): boolean {
  return /^sk-or-v1-[A-Za-z0-9]{16,}$/.test(clave.trim());
}
