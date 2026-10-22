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

/** Pestañas del proyecto visibles en la v2, en orden. */
export const TABS_V2 = ["", "/configurar", "/equipo", "/ajustes"] as const;

/** Rutas de la v1 que la v2 oculta mientras se rediseñan. */
export const RUTAS_V1_OCULTAS = [
  "brief",
  "bom",
  "combinar",
  "convergir",
  "artefactos",
  "presentacion",
  "agente",
  "fuentes",
] as const;
