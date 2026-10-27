import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

/**
 * Fotos de perfil. Se guardan fuera del código, en UPLOADS_DIR/avatares (en
 * producción, junto a la base de datos), y se sirven solo a usuarios con
 * sesión por /api/foto/[id].
 *
 * El tipo se decide por los primeros bytes del archivo, no por lo que diga el
 * navegador: así un archivo disfrazado de imagen no entra.
 */

export const MAX_FOTO_BYTES = 2 * 1024 * 1024;

function carpeta(): string {
  return path.join(process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads"), "avatares");
}

const TIPOS: { ext: string; mime: string; firma: (b: Buffer) => boolean }[] = [
  { ext: "jpg", mime: "image/jpeg", firma: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", firma: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", firma: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

export function mimeDe(nombre: string): string {
  const ext = nombre.split(".").pop() ?? "";
  return TIPOS.find((t) => t.ext === ext)?.mime ?? "application/octet-stream";
}

/** Guarda la foto y devuelve el nombre del archivo, o el error para mostrar. */
export async function guardarFoto(userId: string, archivo: File, anterior: string): Promise<{ ok: true; nombre: string } | { ok: false; error: string }> {
  if (archivo.size === 0) return { ok: false, error: "Elige una foto." };
  if (archivo.size > MAX_FOTO_BYTES) return { ok: false, error: "La foto no puede pasar de 2 MB." };
  const datos = Buffer.from(await archivo.arrayBuffer());
  const tipo = TIPOS.find((t) => t.firma(datos));
  if (!tipo) return { ok: false, error: "La foto debe ser JPG, PNG o WEBP." };

  await mkdir(carpeta(), { recursive: true });
  // Nombre nuevo en cada cambio: así el navegador no muestra la foto vieja.
  const nombre = `${userId}-${crypto.randomBytes(4).toString("hex")}.${tipo.ext}`;
  await writeFile(path.join(carpeta(), nombre), datos, { mode: 0o640 });
  if (anterior && anterior !== nombre && /^[\w-]+\.(jpg|png|webp)$/.test(anterior)) {
    await unlink(path.join(carpeta(), anterior)).catch(() => {});
  }
  return { ok: true, nombre };
}

export async function leerFoto(nombre: string): Promise<Buffer | null> {
  if (!/^[\w-]+\.(jpg|png|webp)$/.test(nombre)) return null;
  try {
    return await readFile(path.join(carpeta(), nombre));
  } catch {
    return null;
  }
}
