import "server-only";

import { deflateRawSync, inflateRawSync } from "node:zlib";

/**
 * Lector y escritor de ZIP minimo.
 *
 * Un respaldo tiene que poder abrirse dentro de diez años, en una maquina que
 * quiza ya no tenga esta aplicacion. Por eso el formato es ZIP estandar y no
 * un contenedor propio: cualquier sistema operativo lo abre con doble clic y
 * adentro hay JSON legible.
 *
 * Se escribe a mano en vez de traer una dependencia porque `zlib` ya viene con
 * Node y lo unico que falta son las cabeceras y el CRC-32. Son cien lineas que
 * no se van a romper solas ni piden mantenimiento.
 *
 * Solo soporta lo que necesitamos: metodo 8 (deflate) y metodo 0 (guardado),
 * sin cifrado, sin ZIP64 y sin carpetas vacias.
 */

// ── CRC-32 ───────────────────────────────────────────────────────────────────

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── Fecha en formato MS-DOS ──────────────────────────────────────────────────

function fechaDos(d: Date) {
  const hora =
    (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
  // El año base de MS-DOS es 1980. Antes de eso no hay como representarlo.
  const anio = Math.max(0, d.getFullYear() - 1980);
  const fecha = (anio << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { hora: hora & 0xffff, fecha: fecha & 0xffff };
}

export type EntradaZip = { nombre: string; contenido: string | Buffer };

/** Arma un ZIP en memoria. Devuelve el archivo completo. */
export function crearZip(entradas: EntradaZip[], fecha = new Date()): Buffer {
  const { hora, fecha: dosFecha } = fechaDos(fecha);
  const locales: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entrada of entradas) {
    const nombre = Buffer.from(entrada.nombre, "utf8");
    const crudo = Buffer.isBuffer(entrada.contenido)
      ? entrada.contenido
      : Buffer.from(entrada.contenido, "utf8");
    const comprimido = deflateRawSync(crudo, { level: 9 });

    // Si comprimir no ayuda (archivos diminutos), se guarda tal cual.
    const usarDeflate = comprimido.length < crudo.length;
    const datos = usarDeflate ? comprimido : crudo;
    const metodo = usarDeflate ? 8 : 0;
    const crc = crc32(crudo);

    const cabecera = Buffer.alloc(30);
    cabecera.writeUInt32LE(0x04034b50, 0);
    cabecera.writeUInt16LE(20, 4); // version necesaria
    cabecera.writeUInt16LE(0x0800, 6); // bit 11: el nombre viene en UTF-8
    cabecera.writeUInt16LE(metodo, 8);
    cabecera.writeUInt16LE(hora, 10);
    cabecera.writeUInt16LE(dosFecha, 12);
    cabecera.writeUInt32LE(crc, 14);
    cabecera.writeUInt32LE(datos.length, 18);
    cabecera.writeUInt32LE(crudo.length, 22);
    cabecera.writeUInt16LE(nombre.length, 26);
    cabecera.writeUInt16LE(0, 28); // sin campo extra

    locales.push(cabecera, nombre, datos);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // version que lo creo
    dir.writeUInt16LE(20, 6); // version necesaria
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(metodo, 10);
    dir.writeUInt16LE(hora, 12);
    dir.writeUInt16LE(dosFecha, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(datos.length, 20);
    dir.writeUInt32LE(crudo.length, 24);
    dir.writeUInt16LE(nombre.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comentario
    dir.writeUInt16LE(0, 34); // disco
    dir.writeUInt16LE(0, 36); // atributos internos
    dir.writeUInt32LE(0, 38); // atributos externos
    dir.writeUInt32LE(offset, 42);

    central.push(dir, nombre);
    offset += cabecera.length + nombre.length + datos.length;
  }

  const cuerpo = Buffer.concat(locales);
  const directorio = Buffer.concat(central);

  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4); // numero de disco
  fin.writeUInt16LE(0, 6); // disco donde arranca el directorio
  fin.writeUInt16LE(entradas.length, 8);
  fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(cuerpo.length, 16);
  fin.writeUInt16LE(0, 20); // sin comentario

  return Buffer.concat([cuerpo, directorio, fin]);
}

/**
 * Lee un ZIP y devuelve sus archivos como texto.
 *
 * Recorre el directorio central, no las cabeceras locales: es el indice
 * autoritativo del formato y el unico que sigue siendo correcto si el archivo
 * fue reescrito por otra herramienta.
 */
export function leerZip(buf: Buffer): Map<string, string> {
  const archivos = new Map<string, string>();

  // El fin del directorio central esta al final, detras de un comentario de
  // longitud variable: hay que buscarlo hacia atras.
  let fin = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65535; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0) throw new Error("El archivo no es un ZIP valido.");

  const total = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);

  for (let i = 0; i < total; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Directorio del ZIP corrupto.");
    const metodo = buf.readUInt16LE(p + 10);
    const crcEsperado = buf.readUInt32LE(p + 16);
    const tamComprimido = buf.readUInt32LE(p + 20);
    const largoNombre = buf.readUInt16LE(p + 28);
    const largoExtra = buf.readUInt16LE(p + 30);
    const largoComentario = buf.readUInt16LE(p + 32);
    const offsetLocal = buf.readUInt32LE(p + 42);
    const nombre = buf.subarray(p + 46, p + 46 + largoNombre).toString("utf8");

    // La cabecera local tiene sus propios campos de longitud variable.
    const nombreLocal = buf.readUInt16LE(offsetLocal + 26);
    const extraLocal = buf.readUInt16LE(offsetLocal + 28);
    const inicio = offsetLocal + 30 + nombreLocal + extraLocal;
    const datos = buf.subarray(inicio, inicio + tamComprimido);

    let crudo: Buffer;
    if (metodo === 0) crudo = Buffer.from(datos);
    else if (metodo === 8) crudo = inflateRawSync(datos);
    else throw new Error(`Compresion no soportada en "${nombre}".`);

    if (crc32(crudo) !== crcEsperado) {
      throw new Error(`El archivo "${nombre}" esta dañado: el CRC no coincide.`);
    }

    archivos.set(nombre, crudo.toString("utf8"));
    p += 46 + largoNombre + largoExtra + largoComentario;
  }

  return archivos;
}
