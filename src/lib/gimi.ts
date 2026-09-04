/**
 * La metodologia del GIM Institute, codificada.
 *
 * Todo lo que hay aqui sale del material oficial del programa Caribe Innova 2026
 * (GIMI Institute / IXL Center). Cuando la aplicacion necesita recordarle algo
 * al equipo — que sombrero toca, que valida un Field of Play, que preguntas
 * componen el Set Up — lo lee de aqui. No se reescribe en las pantallas.
 *
 * Fuentes: DI.pdf, CG.pdf, DV.pdf, CB.pdf, CV.pdf y las laminas fotografiadas
 * de las mentorias (marco "Intencion de Innovar", matriz de posicionamiento).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Sombreros de pensamiento (DI.pdf p7, lamina 003/004)
// ─────────────────────────────────────────────────────────────────────────────

export const HATS = {
  AZUL: { name: "Azul", trait: "Organizado, controlado", color: "#3E7CB1" },
  VERDE: { name: "Verde", trait: "Creativo, nuevas ideas", color: "#4F8A5B" },
  AMARILLO: { name: "Amarillo", trait: "Optimista, positivo", color: "#C9A227" },
  NEGRO: { name: "Negro", trait: "Cauteloso, critico", color: "#2B2B2B" },
  BLANCO: { name: "Blanco", trait: "Analitico", color: "#B9BEC2" },
  ROJO: { name: "Rojo", trait: "Emocional, intuitivo", color: "#B23A3A" },
} as const;

export type HatKey = keyof typeof HATS;

// ─────────────────────────────────────────────────────────────────────────────
// Proceso IDEX (lamina 002/004)
// ─────────────────────────────────────────────────────────────────────────────

export type IdexStage = {
  key: string;
  n: number;
  name: string;
  purpose: string;
  hats: HatKey[];
  /** Fase del software que implementa esta etapa. */
  implemented: boolean;
  route: string | null;
};

export const IDEX: IdexStage[] = [
  {
    key: "configurar",
    n: 1,
    name: "Configurar",
    purpose: "Establecer la meta",
    hats: ["AZUL", "BLANCO"],
    implemented: true,
    route: "brief",
  },
  {
    key: "divergir",
    n: 2,
    name: "Divergir",
    purpose: "Generar ideas",
    hats: ["AZUL", "VERDE", "AMARILLO", "ROJO"],
    implemented: true,
    route: "bom",
  },
  {
    key: "combinar",
    n: 3,
    name: "Combinar",
    purpose: "Combinar ideas",
    hats: ["AZUL", "VERDE", "AMARILLO", "BLANCO", "ROJO"],
    implemented: true,
    route: "combinar",
  },
  {
    key: "convergir",
    n: 4,
    name: "Convergir",
    purpose: "Priorizar ideas",
    hats: ["AZUL", "NEGRO", "BLANCO"],
    implemented: true,
    route: "convergir",
  },
  {
    key: "actuar",
    n: 5,
    name: "Actuar",
    purpose: "Plan de accion",
    hats: ["AZUL", "NEGRO", "BLANCO"],
    implemented: false,
    route: null,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Set Up — Ejercicio 2.1.3, checklist "A que se refieren las soluciones" (CG.pdf p6)
// ─────────────────────────────────────────────────────────────────────────────

export const SOLUTION_FOCI = [
  { key: "EXPERIENCIA", label: "Mejorar la experiencia del cliente" },
  { key: "MERCADO", label: "Capturar un mayor segmento del mercado" },
  { key: "COSTO", label: "Abaratar la solucion disponible" },
  { key: "TECNOLOGIA", label: "Identificar nuevas tecnologias" },
  { key: "TIME_TO_MARKET", label: "Reducir el tiempo para llegar al mercado" },
  { key: "MODELOS", label: "Identificar nuevos modelos de negocio" },
  { key: "COLABORACION", label: "Impulsar nuevas colaboraciones" },
] as const;

export type SolutionFocusKey = (typeof SOLUTION_FOCI)[number]["key"];

// ─────────────────────────────────────────────────────────────────────────────
// Intencion de Innovar (lamina 006)
// ─────────────────────────────────────────────────────────────────────────────

export const RAZON_DE_CAMBIO = [
  { key: "CEO", label: "Director ejecutivo" },
  { key: "ENTORNO", label: "Entorno cambiante" },
  { key: "COMPETENCIA", label: "Competencia" },
  { key: "CLIENTES", label: "Clientes exigentes" },
  { key: "OTRO", label: "Otro" },
] as const;

export const PERFIL_INVERSION = [
  { key: "LOCAL_GLOBAL", label: "Local / Global" },
  { key: "INCREMENTAL_AVANCE", label: "Incremental / Avance" },
  { key: "NUCLEO_LEJOS", label: "Nucleo / Lejos del nucleo" },
  { key: "PEQUENO_GRAN", label: "Pequeño / Gran" },
  { key: "OTRO", label: "Otro" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Reglas metodologicas que la aplicacion hace cumplir
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El mapa se llena con fragmentos crudos. Los insights se leen despues, sobre
 * el mapa lleno — la agenda oficial pone "Manos a la obra: BOM" antes de
 * "Que es un insight". Acoplar las dos cosas produce un mapa que confirma
 * conclusiones preexistentes en vez de descubrirlas.
 *
 * Consecuencia en el codigo: `Fragment` no tiene relacion con ningun modelo de
 * insight, y el agente tiene prohibido redactar conclusiones. Ver
 * `src/lib/agent/prompt.ts`.
 */
export const NO_INSIGHTS_IN_MAP = true;

/** Una celda con menos de este numero de fragmentos se marca como poco explorada. */
export const THIN_CELL_THRESHOLD = 3;

/**
 * Un Field of Play no puede componerse de fragmentos provenientes unicamente de
 * nuevas ofertas de producto: debe cruzar al menos dos dimensiones. Se aplicara
 * en la fase de Fields of Play; se declara aqui para que la regla viva junto a
 * las demas.
 */
export const FOP_MIN_DIMENSIONS = 2;

/** Meta oficial de conceptos de solucion a construir (CB.pdf p3). */
export const TARGET_SOLUTION_CONCEPTS = { min: 4, max: 5 };

/** Criterios de priorizacion, escala 1 a 5 (CV.pdf p4). */
export const PRIORITIZATION_CRITERIA = {
  impacto: {
    label: "Impacto",
    help: "El concepto generara el maximo impacto para los beneficiarios.",
    items: ["Tiene mas demanda", "Facil de implementar", "Facil de escalar"],
  },
  fit: {
    label: "Fit",
    help: "El concepto se ajusta a la demanda del reto y al alcance diseñado.",
    items: ["Resuelve el problema", "Atractivo para el equipo", "Ayuda a alcanzar las metas"],
  },
} as const;
