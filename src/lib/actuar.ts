import { LINEA_CONCEPTO } from "@/lib/gimi";
import { leerJsonSeguro } from "@/lib/v2";

/**
 * Actuar v2: la «línea recta» de cada concepto priorizado. Aquí viven los
 * campos de los pasos que no tienen tabla propia y la regla de cuándo cada paso
 * cuenta como hecho, que comparten la página, el embudo y las acciones.
 */

export type PasoLinea = (typeof LINEA_CONCEPTO)[number]["key"];

export const CAMPOS_BROCHURE = [
  { campo: "titular", label: "Titular", placeholder: "La promesa en una línea, como la leería el cliente", filas: 1 },
  { campo: "problema", label: "El problema", placeholder: "Lo que hoy le duele al cliente, con una cifra si la hay", filas: 2 },
  { campo: "solucion", label: "La solución", placeholder: "Qué es y cómo funciona, sin tecnicismos", filas: 3 },
  { campo: "beneficios", label: "Beneficios", placeholder: "Uno por línea", filas: 3 },
  { campo: "llamado", label: "Llamado a la acción", placeholder: "Qué le pedimos que haga después de leerlo", filas: 1 },
] as const;

export const CAMPOS_CASO = [
  { campo: "inversion", label: "Inversión", placeholder: "Cuánto cuesta arrancar y quién lo pone" },
  { campo: "ingresos", label: "Ingresos o ahorros", placeholder: "De dónde sale la plata y cuánta, por año" },
  { campo: "costos", label: "Costos de operar", placeholder: "Lo que cuesta mantenerlo andando" },
  { campo: "retorno", label: "Retorno", placeholder: "En cuánto tiempo se recupera la inversión" },
  { campo: "riesgos", label: "Riesgos", placeholder: "Lo que podría hacer que no funcione" },
  { campo: "siguiente", label: "Siguiente paso", placeholder: "La decisión o la prueba que viene, con fecha" },
] as const;

export type DatosActuar = {
  brochure: Partial<Record<(typeof CAMPOS_BROCHURE)[number]["campo"], string>>;
  caso: Partial<Record<(typeof CAMPOS_CASO)[number]["campo"], string>>;
};

export function leerActuar(raw: string | null | undefined): DatosActuar {
  const v = leerJsonSeguro<Partial<DatosActuar>>(raw, {});
  return { brochure: v.brochure ?? {}, caso: v.caso ?? {} };
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
    caso: CAMPOS_CASO.filter((x) => lleno(d.caso[x.campo])).length >= 3,
  };
}

export const pasosEnOrden = (a: Record<PasoLinea, boolean>) => LINEA_CONCEPTO.map((p) => a[p.key]);
