import { LINEA_CONCEPTO } from "@/lib/gimi";
import { leerJsonSeguro } from "@/lib/v2";

/**
 * Actuar v2: la «línea recta» de cada concepto priorizado. Aquí viven los
 * campos de los pasos que no tienen tabla propia y la regla de cuándo cada paso
 * cuenta como hecho, que comparten la página, el embudo y las acciones.
 */

export type PasoLinea = (typeof LINEA_CONCEPTO)[number]["key"];

/**
 * El brochure responde las tres preguntas del Taller 3 (lám. 36): ¿cuál es la
 * necesidad?, ¿cuál es la solución?, ¿por qué nosotros?; más el titular y el
 * llamado a la acción del prompt de brochure del mismo taller (lám. 40).
 */
export const CAMPOS_BROCHURE = [
  { campo: "titular", label: "Titular", placeholder: "La promesa en una línea, como la leería el cliente", filas: 1 },
  { campo: "problema", label: "¿Cuál es la necesidad?", placeholder: "El problema y sus principales puntos de dolor, con datos si los hay", filas: 2 },
  { campo: "solucion", label: "¿Cuál es la solución?", placeholder: "El concepto, su propuesta de valor y sus características principales", filas: 3 },
  { campo: "beneficios", label: "¿Por qué nosotros?", placeholder: "Qué nos hace diferentes de las alternativas. Uno por línea", filas: 3 },
  { campo: "llamado", label: "Llamado a la acción", placeholder: "Qué le pedimos que haga después de leerlo", filas: 1 },
] as const;

/**
 * El caso de negocio. La estructura es la del Taller 4 de Caribe Innova
 * (lám. 17 y 32), que es la que evalúan los mentores; cada bloque trae las
 * preguntas del IMBOK donde coinciden (pp. 69-71) y la retroalimentación de
 * los mentores de sept. 2026 (indicadores de impacto en pesos, sin ROI
 * explícito).
 */
export const BLOQUES_CASO = [
  { key: "resumen", n: 1, titulo: "Resumen ejecutivo", fuente: "Taller 4, lám. 19 y 38" },
  { key: "concepto", n: 2, titulo: "El concepto real", fuente: "IMBOK p. 69, elementos 1 a 3; Taller 4, lám. 20-21 y 41-43" },
  { key: "stakeholders", n: 3, titulo: "Stakeholders involucrados", fuente: "Taller 4, lám. 22-23" },
  { key: "modelo", n: 4, titulo: "Modelo de negocio y tamaño de la oportunidad", fuente: "IMBOK p. 69, elementos 4 y 5; Taller 4, lám. 44-45" },
  { key: "riesgos", n: 5, titulo: "Riesgos y opciones", fuente: "IMBOK pp. 70-71; Taller 4, lám. 24-29" },
  { key: "plan", n: 6, titulo: "Plan de acción", fuente: "IMBOK p. 69, elemento 6; Taller 4, lám. 29 y 33" },
  { key: "discurso", n: 7, titulo: "Discurso", fuente: "Taller 4, lám. 34" },
] as const;

export type BloqueCaso = (typeof BLOQUES_CASO)[number]["key"];

export const CAMPOS_CASO = [
  { bloque: "resumen", campo: "resumen", label: "Si tuviera 90 segundos para resumir la idea, ¿qué diría?", placeholder: "Hallazgos clave, la historia y la recomendación" },
  { bloque: "concepto", campo: "aja", label: "El «¡ajá!»", placeholder: "¿Cuál es la pregunta clave y cómo la responde el concepto?" },
  { bloque: "concepto", campo: "beneficios", label: "Beneficios", placeholder: "¿Cuáles son los beneficios de este concepto y quién los obtiene?" },
  { bloque: "concepto", campo: "descripcion", label: "Descripción del concepto", placeholder: "Cómo se ve: canal, aliados y los datos de mercado que lo respaldan" },
  { bloque: "stakeholders", campo: "sponsor", label: "Sponsor interno", placeholder: "¿Qué área aprueba los recursos y mide el KPI principal?" },
  { bloque: "stakeholders", campo: "operador", label: "Usuario operativo", placeholder: "¿Quién interactuará día a día con la solución y sentirá el impacto?" },
  { bloque: "stakeholders", campo: "gatekeepers", label: "Áreas de apoyo (gatekeepers)", placeholder: "¿Quiénes podrían frenarla si no cumple los estándares?" },
  { bloque: "stakeholders", campo: "externos", label: "Externos y cadena de valor", placeholder: "¿Qué aliados, vecinos o proveedores son indispensables?" },
  { bloque: "stakeholders", campo: "ganagana", label: "Gana-gana-gana", placeholder: "Por cada actor clave: por qué participaría y por qué no" },
  { bloque: "modelo", campo: "intercambio", label: "Modelo de negocio", placeholder: "¿Qué stakeholders dan o reciben valor y cómo se genera dinero de ese intercambio?" },
  { bloque: "modelo", campo: "tamano", label: "Tamaño de la oportunidad", placeholder: "¿Qué tan grande es? ¿Cuál es una estimación razonable del valor que captura el cliente?" },
  { bloque: "modelo", campo: "indicadores", label: "Indicadores de impacto en pesos", placeholder: "Ahorros, ingresos o costos evitados, con su fuente" },
  { bloque: "riesgos", campo: "riesgos", label: "Riesgos y mitigación", placeholder: "¿Cuáles son los riesgos y cómo se mitigan?" },
  { bloque: "riesgos", campo: "opciones", label: "Nuevas opciones", placeholder: "¿Qué podría hacer en 3, 5 y 10 años con los aliados y activos que crea?" },
  { bloque: "riesgos", campo: "apoyo", label: "Apoyo y recursos", placeholder: "¿Cómo asegurar el apoyo de las partes interesadas y patrocinadores?" },
  { bloque: "riesgos", campo: "barreras", label: "Barreras de implementación", placeholder: "¿Qué barreras prevé dentro de la organización?" },
  { bloque: "riesgos", campo: "victorias", label: "Victorias tempranas", placeholder: "¿Qué logros tempranos entusiasman? ¿Qué clientes lo probarán primero?" },
  { bloque: "discurso", campo: "eslogan", label: "Eslogan", placeholder: "Una frase que se recuerde" },
  { bloque: "discurso", campo: "alternativas", label: "Alternativas", placeholder: "¿Cuáles son las alternativas y por qué es mejor?" },
  { bloque: "discurso", campo: "copiar", label: "Por qué no pueden copiarlo", placeholder: "¿Por qué los competidores no pueden copiarlo?" },
] as const satisfies readonly { bloque: BloqueCaso; campo: string; label: string; placeholder: string }[];

/** Plazos del plan de acción (Taller 4, lám. 33). */
export const PLAZOS = [
  { key: "CORTO", label: "Corto plazo" },
  { key: "MEDIANO", label: "Mediano plazo" },
  { key: "LARGO", label: "Largo plazo" },
] as const;

export type FilaPlan = { que: string; como: string; quien: string; cuando: string; plazo: string };

export type DatosActuar = {
  brochure: Partial<Record<(typeof CAMPOS_BROCHURE)[number]["campo"], string>>;
  caso: Partial<Record<(typeof CAMPOS_CASO)[number]["campo"], string>>;
  plan: FilaPlan[];
};

export function leerActuar(raw: string | null | undefined): DatosActuar {
  const v = leerJsonSeguro<Partial<DatosActuar>>(raw, {});
  return { brochure: v.brochure ?? {}, caso: v.caso ?? {}, plan: Array.isArray(v.plan) ? v.plan : [] };
}

const lleno = (s?: string) => Boolean(s && s.trim());

/** Qué pasos de la línea ya están hechos, en el orden de LINEA_CONCEPTO. */
export function avanceLinea(c: {
  actuar: string;
  propuestaValor: string;
  artefactos: { status: string }[];
  supuestos: { critical: boolean; failFastTest: string }[];
}): Record<PasoLinea, boolean> {
  const d = leerActuar(c.actuar);
  return {
    brochure: lleno(d.brochure.titular) && lleno(d.brochure.solucion),
    artefacto: c.artefactos.some((a) => a.status === "LISTO" || a.status === "PRESENTADO"),
    ingenieria: c.supuestos.some((s) => s.critical && lleno(s.failFastTest)),
    propuesta: lleno(c.propuestaValor),
    // Hecho cuando tiene resumen, al menos tres bloques con contenido y un paso en el plan.
    caso:
      lleno(d.caso.resumen) &&
      BLOQUES_CASO.filter((b) => CAMPOS_CASO.some((x) => x.bloque === b.key && lleno(d.caso[x.campo]))).length >= 3 &&
      d.plan.some((f) => lleno(f.que)),
  };
}

export const pasosEnOrden = (a: Record<PasoLinea, boolean>) => LINEA_CONCEPTO.map((p) => a[p.key]);
