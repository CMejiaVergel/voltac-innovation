/**
 * La metodologia del GIM Institute, codificada.
 *
 * Todo lo que hay aqui sale del material oficial del programa Caribe Innova 2026
 * (GIMI Institute / IXL Center). Cuando la aplicacion necesita recordarle algo
 * al equipo — que sombrero toca, que valida un Field of Play, que preguntas
 * componen el Set Up — lo lee de aqui. No se reescribe en las pantallas.
 *
 * Fuentes: DI.pdf, CG.pdf, DV.pdf, CB.pdf, CV.pdf, las laminas fotografiadas
 * de las mentorias (marco "Intencion de Innovar", matriz de posicionamiento) y
 * el material del Taller 3 «Conceptos de negocio y artefactos de innovacion»
 * (260917 SPN_GIMI Taller 3.pdf, 17-sep-2026), con las correcciones de mentor
 * que se hicieron en la sesion presencial.
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
    purpose: "Artefactos y plan de accion",
    hats: ["AZUL", "NEGRO", "BLANCO"],
    implemented: true,
    route: "artefactos",
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

/**
 * Meta de conceptos. El Taller 3 pide desarrollar tres por equipo y el ejercicio
 * de priorizacion trae cinco casillas: se formulan hasta cinco y se eligen tres
 * para ingenieria inversa, brochure y protocepto.
 */
export const TARGET_SOLUTION_CONCEPTS = { min: 3, max: 5, seleccion: 3 };

/**
 * Criterios de priorizacion del Ejercicio 2 (Taller 3), escala 1 a 5. Cada eje
 * es el promedio de sus tres preguntas.
 *
 * Las definiciones de `help` son las que fijo el equipo con el mentor: la
 * atractividad mide el impacto potencial en la organizacion; el fit, si hay
 * medios —del equipo y del sponsor— para hacerlo realidad; y la pasion, cuanta
 * sinergia hay entre el concepto y la mirada del mercado, del sponsor y del equipo.
 */
export const PRIORITIZATION_CRITERIA = {
  atractividad: {
    label: "Atractividad",
    help: "El impacto potencial que el concepto tendria en la organizacion.",
    items: ["Tamaño del mercado", "Opciones adicionales", "Recompensa / riesgo"],
  },
  fit: {
    label: "Fit",
    help: "Que tan viable es con los medios del equipo y del sponsor, y cuanto se alinea.",
    items: ["Viabilidad", "Ligado a la estrategia", "Pasion"],
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

// ─────────────────────────────────────────────────────────────────────────────
// Artefactos de innovacion — etapa Actuar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Que es un artefacto, oficializado.
 *
 * El material del GIMI lo menciona una sola vez y no lo define: los
 * innovadores terminan "generando aceptacion de sus ideas a traves de
 * artefactos e historias convincentes" (CG.pdf, lamina 24). La definicion de
 * abajo sale de la practica del equipo en temporadas anteriores —la landing de
 * Quantycs es el ejemplo de referencia— contrastada con dos cuerpos de
 * investigacion: prototipado temprano para obtener retroalimentacion, y el
 * Lean Startup.
 */
export const ARTEFACTO = {
  definicion:
    "Representacion visual de un concepto de solucion, construida sobre uno o varios " +
    "insights, para que la empresa reaccione a una solucion concreta antes del MVP. Vende " +
    "la idea y a la vez expone sus supuestos mas debiles a la critica.",
  /** Por que va antes del MVP, dicho de forma que un mentor del Lean Startup no lo tumbe. */
  frenteAlMvp:
    "Un MVP mide lo que la gente hace: registros, clics, uso. El artefacto mide lo que la " +
    "empresa responde. Por eso lo precede.",
  /** La estructura de la landing de Quantycs, que funciono. En orden. */
  estructura: [
    "Propuesta de valor",
    "El problema",
    "La solucion",
    "Como funciona",
    "Componentes o modulos",
    "Tecnologia",
    "Resultados esperados",
    "Equipo",
    "Aliados",
    "Llamado a reaccionar",
  ],
  reglas: [
    "Cuelga de un concepto de Convergir, no de un insight suelto. Un concepto puede juntar ideas de varios insights: asi se escala la solucion.",
    "Vende, pero expone al menos un supuesto del concepto, el menos probable. Una pieza que solo vende invita a la cortesia, no a la critica.",
    "Cada cifra declara si es meta, estimacion o hecho. Un hecho exige el fragmento del mapa que lo sostiene.",
    "No se presenta como producto existente. Nada de botones de ingresar o iniciar sesion en algo que todavia es un concepto.",
    "El llamado a la accion invita a reaccionar, no a comprar.",
  ],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Plantilla de concepto de solucion — etapa Convergir
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los cinco elementos con que el GIMI describe un concepto (CB.pdf, lamina 44),
 * mas el ancla: el "punto caliente" del mapa del que parte.
 *
 * No es casual que coincidan con las filas del mapa. Quien tiene el problema y
 * que necesita es Mercado; la solucion es Oferta; quien la ofrece y como es
 * Produccion y Modelos. Un concepto que deja vacio uno de los cinco suele
 * delatar una fila del mapa que nadie lleno.
 *
 * Y por eso la regla de CONCEPTO_COMPLETO: no basta con escribir los cinco
 * elementos, cada uno tiene que apoyarse en un fragmento del mapa.
 */
export const PLANTILLA_CONCEPTO = [
  { campo: "quienTieneElProblema", pregunta: "¿Quién tiene el problema?", filaDelMapa: "mercado" },
  { campo: "necesidades", pregunta: "¿Cuáles son sus necesidades?", filaDelMapa: "mercado" },
  { campo: "solucion", pregunta: "¿Cuál es la solución?", filaDelMapa: "oferta" },
  { campo: "quienLaOfrece", pregunta: "¿Quién la está ofreciendo?", filaDelMapa: "produccion" },
  { campo: "comoLoResuelve", pregunta: "¿Cómo lo resolverá?", filaDelMapa: "modelos" },
] as const;

/**
 * Cuando un concepto de negocio esta completo.
 *
 * Lo fijo la mentoria del programa: un concepto recorre las cinco dimensiones
 * del Mapa de Oportunidades —mercado, entrega, oferta, produccion y modelos de
 * negocio— con al menos un fragmento en cada una, y puede usar varios.
 *
 * Un concepto que no toca una dimension no esta mal escrito: esta incompleto.
 * Le falta el cliente, el canal, lo que se vende, con que se produce o como se
 * cobra, y esa ausencia es justo lo que la empresa pregunta primero. Si el mapa
 * no tiene ningun fragmento que lo sostenga en esa dimension, hay dos salidas
 * honestas: investigar hasta encontrarlo o reformular el concepto. Inventar la
 * pieza no es una de ellas.
 *
 * La plataforma lo avisa en la ficha y el agente recibe las dimensiones que
 * faltan. No lo bloquea, igual que el resto de avisos.
 */
export const CONCEPTO_COMPLETO = {
  minimoPorDimension: 1,
  regla:
    "Un concepto de negocio está completo solo si recorre las cinco dimensiones del mapa —mercado, entrega, oferta, producción y modelos de negocio— con al menos un fragmento en cada una.",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Conceptos de negocio — Taller 3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * «Conecte los puntos» (Taller 3, laminas 13, 17 y 19). Un concepto se arma
 * uniendo puntos de cada fila del mapa, empezando por el ancla —el hotspot— y se
 * consolida en una sola frase. El orden de las piezas es el de la plantilla del
 * Ejercicio 1.1; cada una sale de una dimension del mapa.
 */
export const CONECTE_LOS_PUNTOS = [
  { campo: "fraseOferta", antes: "Ofreceremos", dimension: "oferta", ayuda: "productos, servicios, marca" },
  { campo: "fraseMercado", antes: "a/para", dimension: "mercado", ayuda: "el segmento de clientes" },
  { campo: "fraseNecesidad", antes: "quien necesita", dimension: "mercado", ayuda: "la necesidad o experiencia" },
  { campo: "fraseEntrega", antes: "entregado a través de", dimension: "entrega", ayuda: "ocasión, ubicación, canal" },
  { campo: "fraseProduccion", antes: "producido por", dimension: "produccion", ayuda: "competencias, activos, tecnologías" },
  { campo: "fraseModelo", antes: "y generamos dinero mediante", dimension: "modelos", ayuda: "redes, socios, modelo de precio" },
] as const;

export type CampoFrase = (typeof CONECTE_LOS_PUNTOS)[number]["campo"];

/** Compone la frase del Ejercicio 1.1 con las piezas que haya. */
export function fraseConectada(c: Partial<Record<CampoFrase, string>>): string {
  const partes = CONECTE_LOS_PUNTOS.filter((p) => (c[p.campo] ?? "").trim()).map(
    (p) => `${p.antes} ${(c[p.campo] ?? "").trim()}`,
  );
  if (partes.length === 0) return "";
  return partes.join(", ").replace(/, y generamos/, " y generamos") + ".";
}

/**
 * Las preguntas que hacen robusto un concepto (Taller 3, lamina 15), por fila
 * del mapa. Se muestran como guia al llenar el lienzo y se le pasan al agente.
 */
export const PREGUNTAS_ROBUSTAS: Record<string, { titulo: string; preguntas: string[] }> = {
  mercado: {
    titulo: "¿A quién va dirigida la oferta?",
    preguntas: [
      "¿A qué segmento de mercado le apunta?",
      "¿Qué necesidades suple?",
      "¿Qué más se está usando hoy?",
      "¿Quién podría ser un usuario líder?",
      "¿Dónde empezamos?",
    ],
  },
  entrega: {
    titulo: "¿Dónde y cuándo se ofrece?",
    preguntas: [
      "¿En qué lugares se provee la oferta?",
      "¿A través de qué canales?",
      "¿Cómo es la logística?",
      "¿Cuándo la vamos a ofrecer?",
    ],
  },
  oferta: {
    titulo: "¿Cuál es la oferta?",
    preguntas: [
      "¿Qué experiencias involucra?",
      "¿Qué productos involucra?",
      "¿Qué servicios involucra?",
      "¿Cómo es la marca?",
    ],
  },
  produccion: {
    titulo: "¿Qué capacidades se requieren?",
    preguntas: [
      "¿Qué activos necesito para implementarla?",
      "¿Qué tecnologías necesito?",
      "¿Qué competencias necesito?",
    ],
  },
  modelos: {
    titulo: "¿Qué modelo de negocio y aliados?",
    preguntas: [
      "¿Cómo hacemos dinero?",
      "¿Cuál es el modelo de precio?",
      "¿Con quién nos aliamos para producir y adquirir la oferta?",
    ],
  },
};

/**
 * Tipos de concepto segun de donde salen sus puntos (Taller 3, lamina 14). La
 * plataforma lo calcula con la columna —el lente— de los fragmentos anclados:
 * la columna de la compañia es el negocio base.
 */
export const TIPOS_CONCEPTO = {
  INCREMENTAL: {
    label: "Incremental",
    definicion: "Todos sus puntos están dentro del negocio base.",
    quien: "Empleados y personas internas.",
  },
  DISRUPTIVO: {
    label: "Disruptivo",
    definicion: "Combina puntos dentro y fuera del core; es accionable por los puntos de la base.",
    quien: "Personas internas y aliados externos.",
  },
  RADICAL: {
    label: "Radical",
    definicion: "Todos sus puntos están fuera de la base.",
    quien: "Equipo de I+D, personas visionarias o fuera de la caja.",
  },
} as const;

export type TipoConcepto = keyof typeof TIPOS_CONCEPTO;

/** Columna del mapa que representa el negocio base. */
export const COLUMNA_NUCLEO = "compania";

export function tipoDeConcepto(columnas: string[]): TipoConcepto | null {
  if (columnas.length === 0) return null;
  const dentro = columnas.filter((c) => c === COLUMNA_NUCLEO).length;
  if (dentro === columnas.length) return "INCREMENTAL";
  if (dentro === 0) return "RADICAL";
  return "DISRUPTIVO";
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingenieria inversa — Taller 3, «Hacer primero lo primero»
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pregunta 1: ¿en que hay que trabajar para comercializar el concepto? Se
 * responde con ingenieria inversa. Pregunta 2: ¿en que primero? En las tres
 * cosas que mas preocupan: las menos probables. «Priorizar el ultimo obstaculo
 * primero»: cada una se ataca con un experimento de falla rapida.
 *
 * Las reglas de abajo NO estan en las laminas: salieron de las correcciones de
 * mentor sobre el concepto Custodio Hidrico, y son las que hacen que la lista
 * sirva en vez de rellenar diez renglones.
 */
export const INGENIERIA_INVERSA = {
  pregunta: "¿Qué tiene que suceder o ser una realidad para que el concepto sea un éxito?",
  maxCondiciones: 10,
  menosProbables: 3,
  reglas: [
    "Una condición es algo que tiene que llegar a existir para que el concepto se ejecute, no una barrera a verificar.",
    "Lo que el proceso ya dio por sentado —los precedentes y barreras conocidas— no es una condición: se registra aparte como precedente.",
    "Si una condición solo puede existir cuando otra ocurre, se consolidan en una sola. Separarlas multiplica la improbabilidad y hunde a la dependiente.",
    "No hace falta llegar a diez. Pocas, independientes entre sí y bien escritas.",
    "Se marcan exactamente las tres menos probables de resolverse o de hacerse realidad.",
    "Cada una de las tres lleva una prueba de falla rápida con número de interlocutores y un resultado que se pueda contar.",
  ],
  /** Tabla de las tres condiciones (lamina 27), con sus columnas en orden. */
  columnas: [
    "¿Cuáles son las condiciones más importantes a explorar primero para determinar viabilidad?",
    "Para cada una, ¿cuáles son las pruebas de «falla rápida» o experimentos críticos?",
    "¿Cuáles son los resultados deseados o las decisiones esperadas?",
  ],
  ejemplo: {
    condicion: "Validar alianzas potenciales con sellos discográficos",
    prueba: "Hablar con 3 sellos discográficos",
    resultado: "Aprobación de al menos 2 alianzas con dos sellos",
  },
} as const;

/** Detonantes que el taller propone considerar durante el ejercicio (lamina 26). */
export const DETONANTES = [
  { key: "MODELO_NEGOCIO", label: "Modelo de negocio", color: "#3f8f8a" },
  { key: "PROVEEDOR", label: "Proveedor", color: "#a08a2a" },
  { key: "EMPLEADOS", label: "Empleados", color: "#8b949b" },
  { key: "PRODUCCION", label: "Producción", color: "#5b7d93" },
  { key: "OFERTA", label: "Oferta", color: "#b5536b" },
  { key: "ENTREGA", label: "Entrega", color: "#d9671c" },
  { key: "CLIENTES", label: "Clientes", color: "#8fa11c" },
  { key: "ALIADOS", label: "Aliados", color: "#9b5a73" },
  { key: "COMPETENCIA", label: "Competencia", color: "#c42a3a" },
] as const;

export type Detonante = (typeof DETONANTES)[number]["key"];

// ─────────────────────────────────────────────────────────────────────────────
// Artefactos del Taller 3: que valida cada uno, y como se itera
// ─────────────────────────────────────────────────────────────────────────────

/** Los insights que un artefacto puede ganar sobre el negocio (lamina 32). */
export const INSIGHTS_DE_ARTEFACTO = [
  "Precio",
  "Ventas",
  "Riesgo",
  "Especificación",
  "Cliente",
  "Producción",
  "Inversión",
  "Distribución",
] as const;

/**
 * Que insight gana cada tipo de artefacto (lamina 32, matriz de verificacion).
 * «Construir, probar e iterar artefactos de negocio para ganar insights reales
 * acerca del negocio y tener alineacion con toda la cadena de valor.»
 */
export const MATRIZ_ARTEFACTOS: Record<string, readonly (typeof INSIGHTS_DE_ARTEFACTO)[number][]> = {
  BROCHURE: ["Precio", "Ventas", "Especificación", "Cliente", "Producción"],
  ORDEN_COMPRA: ["Precio", "Ventas", "Riesgo", "Especificación", "Cliente", "Distribución"],
  PROTOTIPO: ["Riesgo", "Especificación", "Producción", "Inversión"],
  NDA: ["Riesgo", "Producción", "Inversión"],
  DISCURSO_VENTA: ["Precio", "Ventas", "Cliente"],
  ACUERDO_ENTREGA: ["Riesgo", "Producción", "Distribución"],
};

/** Hacer → probar con el mercado → revisar hallazgos → cambiar. Al menos siete veces (lamina 34). */
export const ITERACIONES_ARTEFACTO = {
  minimo: 7,
  ciclo: ["Hacer el artefacto", "Probar con el mercado", "Revisar hallazgos", "Hacer cambios"],
  resultados: ["Insights de mercado", "Artefactos más personalizados", "Clientes o proveedores potenciales"],
} as const;

/**
 * Estructura del brochure (lamina 40, guia de produccion con IA) y del
 * protocepto. El brochure cabe en dos paginas; el protocepto —la version
 * extendida— en tres hojas como maximo, por correccion del mentor.
 */
export const BROCHURE = {
  paginas: 2,
  hojasProtocepto: 3,
  secciones: [
    { key: "problema", titulo: "Problema", pregunta: "¿Qué problema estamos resolviendo? Datos relevantes y principales pain points." },
    { key: "solucion", titulo: "Solución", pregunta: "¿Qué estamos ofreciendo? Concepto, propuesta de valor, características y un mockup." },
    { key: "diferenciacion", titulo: "Diferenciación", pregunta: "¿Qué hace diferente nuestra solución? Los 3 principales diferenciadores." },
    { key: "impacto", titulo: "Impacto", pregunta: "¿Cuáles son los 3 principales beneficios potenciales para la empresa?" },
    { key: "equipo", titulo: "Equipo", pregunta: "Nombres, roles y fotografías." },
  ],
  /** Preguntas del brochure conceptual por dimension (lamina 35). */
  porDimension: {
    mercado: ["¿Qué necesidades resolvemos?", "¿Cómo resolvemos la necesidad?", "¿Por qué es mejor que las alternativas?"],
    produccion: ["¿Cómo hacemos que esto sea más barato, más rápido y mejor?"],
    entrega: ["¿Cómo pueden los clientes adquirir nuestro producto o servicio?"],
    oferta: ["¿Qué tiene de innovador y emocionante?"],
    modelos: ["¿Cuál es nuestra estrategia de precios?", "¿Por qué otros no pueden copiarnos?", "¿Quiénes son nuestros socios?"],
  } as Record<string, string[]>,
  reglas: [
    "Ejecutivo, altamente visual, conciso y convincente. Sin párrafos largos.",
    "Datos externos con fuente confiable. No inventar información, alianzas ni capacidades de la empresa.",
    "Texto legible impreso: si no cabe, se reorganiza o se recorta, no se achica la letra.",
    "Revisarlo siempre y enviar los ajustes a la IA para mejorarlo.",
  ],
} as const;

/**
 * Prompts de la guia de produccion con IA (laminas 40 y 43), listos para
 * copiar. Se completan con los datos del concepto; la persona adjunta ademas
 * la foto del concepto, el logo del sponsor y un pantallazo de su sitio web.
 */
export function promptBrochure(concepto: { titulo: string; frase: string; propuestaValor: string }): string {
  return [
    `Crea un brochure ejecutivo y profesional de 2 páginas para el concepto de negocio «${concepto.titulo}».`,
    concepto.frase ? `Descripción del concepto: ${concepto.frase}` : "",
    concepto.propuestaValor ? `Propuesta de valor: ${concepto.propuestaValor}` : "",
    "Utiliza el logo de la empresa y el pantallazo de su página web como referencia para mantener su identidad visual, colores, estilo y look & feel.",
    "El brochure debe comunicar de forma clara y visual:",
    ...BROCHURE.secciones.map((s) => `• ${s.titulo}: ${s.pregunta}`),
    "Mantén el brochure ejecutivo, altamente visual, conciso y convincente. Evita párrafos largos. Utiliza fuentes confiables para datos externos y no inventes información, alianzas o capacidades de la empresa.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function promptMockup(concepto: { titulo: string; frase: string }): string {
  return [
    `Crea un mockup visual y profesional del concepto de negocio «${concepto.titulo}».`,
    concepto.frase ? `Descripción del concepto: ${concepto.frase}` : "",
    "El objetivo es mostrar cómo funcionaría la solución en la realidad y permitir que un ejecutivo pueda entender rápidamente el concepto.",
    "Utiliza el logo y el pantallazo del website de la empresa como referencia para mantener su identidad visual y look & feel.",
    "Representa los elementos más importantes de la solución, cómo se utilizaría y, cuando sea relevante, quién la utilizaría y en qué contexto.",
    "Mantén el resultado realista, ejecutivo, visualmente atractivo y fácil de entender. No inventes funcionalidades que no estén incluidas en el concepto.",
    "No quiero una presentación sino algo que muestre visualmente la solución que propongo.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cierre de sesion — «Experiencia de la jornada»
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El ejercicio con que cierra cada taller (Taller 3, lamina 45): individual,
 * tres aprendizajes y lo que mas se disfruto; en grupo se consolida en una hoja
 * sin repetir factores; y se cierra con los siguientes pasos.
 */
export const LECCIONES = {
  tipos: {
    APRENDIZAJE: { label: "Aprendizajes", pregunta: "¿Cuáles fueron las 3 cosas que aprendió hoy?" },
    DISFRUTE: { label: "Lo que más disfrutó", pregunta: "¿Qué fue lo que más disfrutó y por qué?" },
    PROXIMO_PASO: { label: "Siguientes pasos", pregunta: "¿Qué hay que traer a la próxima mentoría?" },
  },
  regla: "Se consolida en una sola hoja por equipo, sin repetir factores.",
} as const;

export type TipoLeccion = keyof typeof LECCIONES.tipos;
export const TIPOS_LECCION = ["APRENDIZAJE", "DISFRUTE", "PROXIMO_PASO"] as const;
