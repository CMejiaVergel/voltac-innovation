/**
 * Plataforma v2 (rediseño de octubre de 2026, tras la retroalimentación del
 * mentor). Mientras se construye, convive con la v1: con la bandera encendida
 * se ocultan las etapas viejas y se trabaja por etapas desde Configurar.
 *
 * Principio de la v2: las personas son las protagonistas del proceso. La IA
 * solo asiste en pasos puntuales donde potencia la herramienta; nunca decide
 * ni llena etapas por su cuenta.
 */
export const V2 = process.env.NEXT_PUBLIC_PLATAFORMA_V2 === "1";

/**
 * Descarga del caso en PPTX. Apagada por ahora (27-oct-2026): los equipos
 * arman sus láminas con el formato que prefieran a partir de la información
 * de la plataforma. El generador (lib/presentacionV2.ts) se conserva para
 * cuando se defina cómo exportar.
 */
export const PPTX_ACTIVO = false;

/** Pestañas del proyecto visibles en la v2, en orden. */
export const TABS_V2 = ["", "/configurar", "/divergir", "/plataformas", "/combinar", "/convergir", "/actuar", "/equipo", "/ajustes"] as const;

/** Rutas de la v1 que la v2 oculta mientras se rediseñan. */
export const RUTAS_V1_OCULTAS = [
  "brief",
  "bom",
  "artefactos",
  "presentacion",
  "agente",
  "fuentes",
] as const;

/**
 * Titulo que muestra un post-it del mapa. Si el equipo no le ha puesto uno, se
 * toma el arranque del texto: la primera frase, recortada a unas pocas palabras.
 */
export function tituloPostit(f: { titulo: string; text: string }, palabras = 7): string {
  if (f.titulo.trim()) return f.titulo.trim();
  const frase = f.text.trim().split(/(?<=[.:;])\s|\n/)[0] ?? "";
  const ws = frase.replace(/[.:;,]+$/, "").split(/\s+/);
  return ws.length > palabras ? ws.slice(0, palabras).join(" ") + "…" : ws.join(" ");
}

/** JSON.parse que no revienta: el valor por defecto si el texto no es JSON válido. */
export function leerJsonSeguro<T>(raw: string | null | undefined, porDefecto: T): T {
  try {
    const v = JSON.parse(raw || "");
    return v && typeof v === "object" ? (v as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}

/**
 * Color fijo de cada persona, como en la edición colaborativa de Office: el
 * mismo usuario se ve siempre del mismo color en votos, post-its y conceptos,
 * para saber quién intervino en qué. Sale del id, así que no hay que guardarlo.
 */
const COLORES_PERSONA = ["#E07A5F", "#3D9BE9", "#E9B949", "#8E7CC3", "#4CAF8F", "#E86FA5", "#5CC8D7", "#C08552", "#9BC53D", "#F28C38"];

export function colorDePersona(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES_PERSONA[h % COLORES_PERSONA.length];
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
