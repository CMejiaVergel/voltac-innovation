/**
 * Plantillas del Mapa de Oportunidades.
 *
 * El motor no sabe cuantas filas ni columnas hay: las lee de la plantilla, que
 * vive en base de datos como JSON. Aqui estan las dos plantillas del sistema,
 * que el seed inserta y la UI no deja editar.
 *
 * Existen dos porque el material GIMI trae dos mapas distintos y no son
 * intercambiables:
 *
 *  - `gimi-5x5`  Mapa de Oportunidades de Negocio del taller de Caribe Innova
 *                (foto 017.jpg del tablero fisico, agenda 008.jpeg). Es el mapa
 *                de exploracion: 5 dimensiones del negocio x 5 lentes.
 *
 *  - `gimi-idex-5x2`  Mapa de Oportunidades del curriculo IDEX (DV.pdf p5/p9/p10,
 *                CB.pdf p4). Es del que se toma el "punto ancla" para construir
 *                Conceptos de Solucion en la etapa Combinar.
 */

export type TemplateRow = {
  id: string;
  name: string;
  /** Facetas que componen la dimension, en la franja de color. */
  facets: string;
  color: string;
};

export type TemplateCol = {
  id: string;
  name: string;
  /** Pregunta guia que se muestra bajo el titulo de la columna. */
  question: string;
  /** Ayuda larga: aparece como placeholder y se le entrega al agente. */
  hint: string;
  /** Pasos del ejercicio de la lente, tal como los plantea el GIMI. */
  ejercicio?: string[];
  /** De dónde sale el ejercicio, con lámina o página. */
  fuente?: string;
};

export type TemplateShape = { rows: TemplateRow[]; cols: TemplateCol[] };

export const TEMPLATE_5X5: TemplateShape = {
  // Facetas completas del mapa ya organizado (Masterclass 2, láminas 67 y 91).
  // «Otros» va al final de cada fila para no mover los índices de las facetas
  // que los fragmentos ya tienen marcadas.
  rows: [
    {
      id: "mercado",
      name: "Mercado",
      facets: "Clientes · Necesidades · Experiencias · Otros",
      color: "#8B9B3C",
    },
    {
      id: "entrega",
      name: "Entrega",
      facets: "Ocasiones · Localidades · Canales · Fuerza de ventas · Otros",
      color: "#D98B3F",
    },
    {
      id: "oferta",
      name: "Oferta",
      facets: "Productos · Servicios · Marcas · Atributos · Otros",
      color: "#9E6F72",
    },
    {
      id: "produccion",
      name: "Producción",
      facets: "Competencias · Activos · Tecnologías · Capacidades · Otros",
      color: "#6B7C8C",
    },
    {
      id: "modelos",
      name: "Modelos de Negocio",
      facets: "Redes y Aliados · Modelos de Precio · Otros",
      color: "#4E8C85",
    },
  ],
  // Cada lente con el título y el ejercicio que le da el GIMI (Masterclass 2,
  // lámina 92 para los títulos; IMBOK pp. 37-48).
  cols: [
    {
      id: "compania",
      name: "Su Compañía",
      question: "El perfil de su compañía hoy",
      hint: "Lo que la empresa es y hace hoy en esta dimensión: un análisis interno de su cadena de valor. Anote todo, incluso lo que parezca obvio.",
      ejercicio: [
        "Recorra la dimensión faceta por faceta: ¿qué tiene, qué hace y qué vende la empresa hoy?",
        "Un punto por post-it. Anote todo, incluso lo que parezca obvio o descabellado.",
      ],
      fuente: "Masterclass 2, lám. 71 y 92 · IMBOK p. 38",
    },
    {
      id: "futuro",
      name: "Futuro",
      question: "Avance rápido… ¿cuál es ese futuro?",
      hint: "Tendencias de la industria ampliada, más allá del «arenero» de la empresa, y lo que cambiarían en esta dimensión.",
      ejercicio: [
        "Liste tendencias en cuatro frentes: megafuerzas globales (económico, tecnológico, social, político, medioambiental), canal y cliente, proveedores, y competidores y sustitutos.",
        "Ubíquelas por impacto e incertidumbre. Las de alto impacto son las que le dan ventaja o para las que tiene que estar preparado.",
        "Imagine el futuro que traen las de alto impacto y anote en el mapa lo que cambiaría en cada dimensión.",
      ],
      fuente: "Masterclass 2, lám. 74-78 · IMBOK pp. 40-45",
    },
    {
      id: "compet",
      name: "Competidores",
      question: "Competidores usuales e inusuales",
      hint: "Lo que hace, o haría, un competidor usual o inusual en esta dimensión. Actúe como si fuera él.",
      ejercicio: [
        "Usuales: los competidores actuales.",
        "Inusuales: empresas que están redefiniendo la industria, empresas en otras ubicaciones y empresas pequeñas emergentes.",
        "Actúe como si fuera cada uno de ellos: ¿qué haría en esta dimensión?",
      ],
      fuente: "Masterclass 2, lám. 80-84 · IMBOK p. 45",
    },
    {
      id: "adyac",
      name: "Adyacencias",
      question: "Nuevos aliados… nuevos movimientos",
      hint: "Un aliado posible de otra industria, con nombre, y lo que la alianza le daría a la empresa en esta dimensión.",
      ejercicio: [
        "Piense qué pasaría si aplicara a su industria los factores clave de éxito de otras industrias.",
        "Escriba el nombre de un aliado posible.",
        "Si nos aliamos con él, ¿a qué podríamos acceder? A sus mercados, su oferta, su entrega, su producción o su modelo de negocio.",
      ],
      fuente: "Masterclass 2, lám. 86-88 · IMBOK pp. 46-47",
    },
    {
      id: "cadena",
      name: "Cadena de Valor",
      question: "Caminando en los zapatos de otros",
      hint: "Cómo un actor de la cadena de valor (proveedor, cliente, distribuidor, regulador u otro aliado) ha solucionado un reto similar.",
      ejercicio: [
        "Póngase en los zapatos de proveedores, clientes, distribuidores, gobierno y reguladores, y otros aliados.",
        "¿Cómo han solucionado retos similares a lo largo de la cadena de valor?",
      ],
      fuente: "Masterclass 2, lám. 89-90 · IMBOK p. 48",
    },
  ],
};

export const TEMPLATE_IDEX_5X2: TemplateShape = {
  rows: [
    {
      id: "actual",
      name: "Ideas actuales de solucion",
      facets: "Lo que hoy existe para atender el problema",
      color: "#6B7C8C",
    },
    {
      id: "futuro",
      name: "Ideas de solucion a futuro",
      facets: "Si el presupuesto fuera ilimitado",
      color: "#4E8C85",
    },
  ],
  cols: [
    {
      id: "quien",
      name: "Quien tiene el problema",
      question: "Consumidores / beneficiarios",
      hint: "Personas o actores concretos que sufren el problema. No categorias abstractas.",
    },
    {
      id: "necesidades",
      name: "Cuales son sus necesidades",
      question: "Necesidades y experiencias",
      hint: "Necesidad expresada desde el actor, no desde la solucion.",
    },
    {
      id: "solucion",
      name: "Cual es la solucion",
      question: "Productos, servicios, otros",
      hint: "Solucion existente y verificable. Una por fragmento.",
    },
    {
      id: "ofrece",
      name: "Quien la esta ofreciendo",
      question: "Actores clave",
      hint: "Organizacion nombrada que hoy provee esa solucion.",
    },
    {
      id: "como",
      name: "Como se ofrece",
      question: "Aliados, modelos de negocio, activos",
      hint: "Mecanismo de entrega: quien se alia con quien, como se cobra, que activo lo sostiene.",
    },
  ],
};

export const SYSTEM_TEMPLATES = [
  {
    key: "gimi-5x5",
    name: "BOM 5x5 — Dimensiones x Lentes",
    description:
      "Mapa de Oportunidades de Negocio del taller Caribe Innova 2026. Cinco dimensiones del negocio cruzadas con cinco lentes de observacion. Es el mapa de exploracion de la etapa Divergir.",
    shape: TEMPLATE_5X5,
  },
  {
    key: "gimi-idex-5x2",
    name: "Mapa de Oportunidades IDEX — Actual / Futuro",
    description:
      "Mapa del curriculo IDEX (DV.pdf, CB.pdf). Cinco preguntas por dos horizontes. Es el mapa del que se toma el punto ancla para construir Conceptos de Solucion.",
    shape: TEMPLATE_IDEX_5X2,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Lectura y validacion
// ─────────────────────────────────────────────────────────────────────────────

export function parseShape(rows: string, cols: string): TemplateShape {
  return {
    rows: JSON.parse(rows) as TemplateRow[],
    cols: JSON.parse(cols) as TemplateCol[],
  };
}

export function cellKey(rowId: string, colId: string): string {
  return `${rowId}|${colId}`;
}

/** Una coordenada solo es valida si existe en la plantilla del mapa. */
export function isValidCoord(shape: TemplateShape, rowId: string, colId: string): boolean {
  return (
    shape.rows.some((r) => r.id === rowId) && shape.cols.some((c) => c.id === colId)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Items de una dimension
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las facetas de una fila, ya separadas.
 *
 * Cada dimension del mapa se compone de varias: Mercado son Clientes,
 * Necesidades y Experiencias. Vienen juntas en un texto porque asi se pintan
 * en la franja de color, pero para marcar a cual pertenece un fragmento hacen
 * falta sueltas. El numero varia por fila —Modelos de Negocio solo tiene dos—
 * asi que nada puede asumir que siempre son tres.
 */
export function itemsDeFila(facets: string): string[] {
  return facets
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Colores de los items, por posicion dentro de su fila.
 *
 * Son oscuros a proposito: se pintan sobre el papel claro del post-it, no
 * sobre el fondo del tablero.
 */
export const COLORES_ITEM = ["#2F5D8C", "#8E5324", "#2F7D5F", "#7A3E8E"] as const;

export function colorDeItem(i: number): string {
  return COLORES_ITEM[i % COLORES_ITEM.length];
}

/** Lee el JSON de items de un fragmento sin reventar si viene mal escrito. */
export function parseItems(raw: string): number[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n >= 0) : [];
  } catch {
    return [];
  }
}

/**
 * La forma vigente de la plantilla de un mapa.
 *
 * Las plantillas del sistema no se editan desde la interfaz, así que su forma
 * vigente es la del código: una corrección de las guías llega a todos los
 * mapas sin esperar a que alguien vuelva a correr el seed.
 */
export function shapeDePlantilla(t: { key: string; isSystem: boolean; rows: string; cols: string }): TemplateShape {
  const sistema = t.isSystem ? SYSTEM_TEMPLATES.find((s) => s.key === t.key) : undefined;
  return sistema ? sistema.shape : parseShape(t.rows, t.cols);
}
