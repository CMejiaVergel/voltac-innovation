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
};

export type TemplateShape = { rows: TemplateRow[]; cols: TemplateCol[] };

export const TEMPLATE_5X5: TemplateShape = {
  rows: [
    {
      id: "mercado",
      name: "Mercado",
      facets: "Clientes · Necesidades · Experiencias",
      color: "#8B9B3C",
    },
    {
      id: "entrega",
      name: "Entrega",
      facets: "Ocasiones · Localidades · Canales",
      color: "#D98B3F",
    },
    {
      id: "oferta",
      name: "Oferta",
      facets: "Productos · Servicios · Marcas",
      color: "#9E6F72",
    },
    {
      id: "produccion",
      name: "Produccion",
      facets: "Competencias · Activos · Tecnologias",
      color: "#6B7C8C",
    },
    {
      id: "modelos",
      name: "Modelos de Negocio",
      facets: "Redes y Aliados · Modelos de Precio",
      color: "#4E8C85",
    },
  ],
  cols: [
    {
      id: "compania",
      name: "Su Compañia",
      question: "Que es la empresa hoy en esta dimension",
      hint: "Hechos del presente verificables: lo que la empresa ya hace, tiene o vende. Sin proyecciones.",
    },
    {
      id: "futuro",
      name: "Futuro",
      question: "Hacia donde va en 5 a 10 años",
      hint: "Tendencias, regulacion en camino y cambios de demanda que afectaran esta dimension. Fecha explicita cuando exista.",
    },
    {
      id: "compet",
      name: "Competidores",
      question: "Que hacen bien los rivales",
      hint: "Movimiento concreto y atribuible de un competidor nombrado. Que hizo, no que tan bueno es.",
    },
    {
      id: "adyac",
      name: "Adyacencias",
      question: "Que mecanismo resolvio otra industria",
      hint: "MECANISMO TRASLADABLE, no nombre de empresa. Mal: 'Coca-Cola'. Bien: 'devuelve a la cuenca el agua que consume mediante programas de reposicion'.",
    },
    {
      id: "cadena",
      name: "Cadena de Valor",
      question: "Quien esta aguas arriba y aguas abajo",
      hint: "Actores concretos antes y despues de la empresa, y que control ejercen sobre el reto.",
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
