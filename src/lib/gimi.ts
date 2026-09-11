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

// ─────────────────────────────────────────────────────────────────────────────
// Anatomia del insight — etapa Combinar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las tres piezas de un insight, en orden.
 *
 * Esto NO es una preferencia de redaccion. Salio de seis iteraciones sobre el
 * reto de Cabot con correcciones de mentor de por medio, y cada pieza responde
 * a un modo concreto de fallar:
 *
 *   Sin PATRON      el insight es una anecdota. Cierto para esta empresa y
 *                   para nadie mas, asi que no se puede llevar a ningun sitio.
 *   Sin HECHO       es una opinion. La primera pregunta —«¿como sabes eso?»—
 *                   lo tumba, y es siempre la primera pregunta.
 *   Sin IMPLICACION es un dato reencuadrado. Se lee bien, no cambia nada.
 *
 * El orden importa al exponerlo: el patron primero hace que quien escucha
 * asienta antes de oir el dato, y entonces el dato no se discute, se encaja.
 *
 * Las cuatro piezas viven en columnas propias de `Insight` para que la
 * plataforma pueda avisar de cual falta. Ver `prisma/schema.prisma`.
 */
export const ANATOMIA_INSIGHT = [
  {
    campo: "pattern",
    n: 1,
    nombre: "El patrón",
    resumen: "Una regularidad difícilmente cuestionable.",
    ayuda:
      "Algo que quien escucha reconoce como cierto sin pedir prueba. No una hipótesis ni una " +
      "opinión del equipo. Se escribe en general, sin nombrar todavía a la empresa del reto.",
    prueba: "Si alguien de la sala puede responder «eso depende», todavía no es un patrón.",
    obligatorio: true,
  },
  {
    campo: "fact",
    n: 2,
    nombre: "El hecho",
    resumen: "El dato del mapa que demuestra que el patrón se cumple aquí.",
    ayuda:
      "Con cifra, con actor nombrado, y tomado de un fragmento que ya está en el mapa. Es la " +
      "pieza que ancla el patrón a este reto y a esta empresa.",
    prueba: "Si no puedes señalar el punto del que sale, no lo escribas.",
    obligatorio: true,
  },
  {
    campo: "implication",
    n: 3,
    nombre: "La implicación",
    resumen: "El «¿y qué?».",
    ayuda:
      "Lo que cambia al leer el patrón y el hecho juntos, y que ninguno de los dos decía solo. " +
      "Suele ser un desplazamiento: el problema no está donde se buscaba, o el candidato no es " +
      "el que parecía.",
    prueba: "Si se puede sustituir por el hecho sin perder nada, es una glosa.",
    obligatorio: true,
  },
  {
    campo: "business",
    n: 4,
    nombre: "La oportunidad",
    resumen: "El negocio nuevo que abre la implicación.",
    ayuda:
      "No es una pieza del razonamiento: es el examen que decide si el insight vale. Tiene que " +
      "abrir algo que la empresa no veía antes de escucharlo.",
    prueba:
      "Si lo único que abre es «hay que resolver el reto», el insight está reafirmando el " +
      "punto de partida. Se tira y se vuelve al mapa.",
    obligatorio: true,
  },
  {
    campo: "limitNote",
    n: 5,
    nombre: "El límite",
    resumen: "Hasta dónde llega la evidencia.",
    ayuda:
      "Qué NO se puede afirmar con los puntos que hay. Se declara dentro del insight, no se " +
      "espera a que lo pregunten.",
    prueba: "Un insight sin límite declarado se desmonta en la primera pregunta difícil.",
    obligatorio: true,
  },
] as const;

export type PiezaInsight = (typeof ANATOMIA_INSIGHT)[number]["campo"];

/**
 * El examen que decide si un insight se queda.
 *
 * Nace de una correccion literal del equipo: «es mejor tener pocos insights
 * que muchos errados. Si no se determina que este insight sea relevante,
 * construye uno nuevo o eliminalo».
 */
export const EXAMEN_INSIGHT = [
  "¿El patrón lo aceptaría alguien que no trabaja en esto, sin pedir prueba?",
  "¿El hecho sale de un fragmento concreto del mapa, con su cifra?",
  "¿La implicación dice algo que ninguna de las dos piezas decía sola?",
  "¿Abre una oportunidad que la empresa no veía, o solo reafirma su propio reto?",
  "¿Contradice algo que la empresa fijó explícitamente en el brief?",
  "¿Está declarado hasta dónde llega la evidencia?",
] as const;
