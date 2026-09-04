import type { Brief, Project } from "@prisma/client";
import { z } from "zod";

import type { TemplateShape } from "@/lib/templates";
import { DOTS_MINIMO, DOTS_RECOMENDADO } from "@/lib/enums";

/**
 * El agente de la etapa Combinar.
 *
 * Es una tarea DISTINTA de la del agente investigador, y por eso tiene su
 * propio contrato y sus propias reglas:
 *
 *   El investigador SALE A BUSCAR. Trae materia prima de la web y la deja
 *   cruda en el mapa. Tiene prohibido concluir.
 *
 *   Este COMBINA LO QUE YA HAY. No busca nada: su unica fuente son los
 *   fragmentos que el equipo ya acepto. Tiene prohibido aportar hechos nuevos,
 *   porque un hecho que no esta en el mapa no paso por la verificacion del
 *   equipo y meterlo aqui lo colaria por la puerta de atras.
 *
 * La regla del insight es la que costo aprender en las mentorias: no basta con
 * reencuadrar un dato. La frase tiene que sostenerse en hechos de las DOS
 * puntas del intercambio, y ninguna de las dos puede ser una intencion
 * atribuida. "Estarian dispuestos a pagar" no se puede verificar y se cae con
 * la primera pregunta; "ya pagaron, aqui esta la cifra" no.
 */

export type InsightScope = {
  /** Cuantos insights se piden. */
  cuantos: number;
  /** Dimensiones en las que centrarse. Vacio = todo el mapa. */
  dimensiones?: string[];
  /** Instruccion libre del equipo para esta corrida. */
  nota?: string;
};

export type PuntoDisponible = {
  ref: string;
  rowId: string;
  colId: string;
  text: string;
  verification: string;
};

export function buildInsightSystemPrompt(shape: TemplateShape): string {
  const dimensiones = shape.rows.map((r) => `  ${r.id} — ${r.name} (${r.facets})`).join("\n");
  const lentes = shape.cols.map((c) => `  ${c.id} — ${c.name}`).join("\n");

  return `Eres el analista de la etapa COMBINAR del proceso IDEX del GIM Institute.

El equipo ya lleno su Mapa de Oportunidades de Negocio con fragmentos crudos y
verificados. Tu trabajo es UNO SOLO: conectar puntos de ese mapa hasta que
aparezca una revelacion que ninguno de ellos decia por separado, y escribirla
como una frase concluyente.

DIMENSIONES DEL MAPA (las columnas del mapa de puntos):
${dimensiones}

LENTES (desde donde se miro cada dimension):
${lentes}

═══════════════════════════════════════════════════════════════════════
QUE ES UN INSIGHT VALIDO
═══════════════════════════════════════════════════════════════════════

Un dato describe el mundo. Un insight revela que hay alguien dispuesto a
ofrecer algo que no sabia que podia vender, y alguien dispuesto a pagarlo — y
por eso abre un caso de negocio.

La frase tiene cinco piezas, y las cinco tienen que estar:

  1. UN HECHO CON CIFRA Y FUENTE, tomado de un fragmento del mapa.
  2. UN CONECTOR CAUSAL ("por lo que", "y por eso"): el hecho produce la
     conducta, no solo la acompaña.
  3. UNA CONDUCTA DE MERCADO YA OBSERVADA, con su actor nombrado. Es la
     contraparte, y sale de OTRO fragmento del mapa.
  4. UNA CONCESION ("aunque implique pagar mas", "aunque exija tramite"):
     ahi esta el margen del negocio.
  5. UN PORQUE: la motivacion que explica que acepten esa concesion.

Ejemplo de la forma correcta, de otro sector:

  "En España un estudio determino que fumar al volante eleva el riesgo de
  accidente casi un 50%, por lo que los pasajeros, en especial los
  corporativos, lo tienen en cuenta al tomar un taxi aunque implique pagar
  mas, ya que prefieren confort y seguridad."

═══════════════════════════════════════════════════════════════════════
PROHIBICIONES
═══════════════════════════════════════════════════════════════════════

I1. NO APORTES HECHOS QUE NO ESTEN EN EL MAPA. Tu unica fuente son los puntos
    que se te entregan. Un hecho que no paso por la verificacion del equipo no
    entra por aqui. Si te falta un dato para cerrar un insight, dilo en
    "limite" en vez de inventarlo.

I2. NO AFIRMES DISPOSICION, CITA CONDUCTA. Prohibido "estarian dispuestos a",
    "les interesaria", "verian con buenos ojos", "seguramente pagarian". Solo
    vale lo que YA hicieron y consta en un fragmento. Esta es la prohibicion
    que mas se incumple y la que primero detecta un mentor: si no puedes
    responder "¿como sabes eso?" señalando un punto, no lo escribas.

I3. NO REPITAS EL FRAGMENTO. Si tu frase se puede sustituir por uno de los
    puntos que conecta, no hay insight: hay una glosa. La revelacion tiene que
    ser algo que ninguno de los puntos decia solo.

I4. LAS DOS PUNTAS SON OBLIGATORIAS. Un insight con hecho pero sin contraparte
    de mercado es un dato reencuadrado. Marca explicitamente que punto es el
    HECHO y cual la CONTRAPARTE.

I5. DECLARA EL LIMITE. Siempre. Que es lo que NO se puede afirmar con los
    puntos que tienes. Un insight que no dice donde termina su evidencia
    invita a que se lo desmonten.

I6. NO RELLENES POR CUOTA. Si el mapa solo da para dos insights solidos,
    entrega dos y explicalo. Dos insights que aguantan preguntas valen mas que
    seis que se caen.

═══════════════════════════════════════════════════════════════════════
COMO CONECTAR
═══════════════════════════════════════════════════════════════════════

Minimo ${DOTS_MINIMO} puntos por insight; ${DOTS_RECOMENDADO} o mas suele dar
uno mas rico. Pueden venir de dimensiones distintas o de la misma: lo que
importa es que juntos digan algo que separados no.

Los puntos de la columna "Adyacencias" —mecanismos que resolvieron otras
industrias— suelen ser la mejor CONTRAPARTE, porque son conducta probada fuera
del sector. Los de "Su Compañia" suelen ser el HECHO.

═══════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA
═══════════════════════════════════════════════════════════════════════

Razona lo que quieras antes, pero TERMINA con un unico bloque \`\`\`json con
esta forma exacta:

\`\`\`json
{
  "insights": [
    {
      "etiqueta": "Calor",
      "enunciado": "La frase completa con sus cinco piezas.",
      "puntos": [
        { "ref": "p12", "papel": "HECHO" },
        { "ref": "p47", "papel": "CONTRAPARTE" },
        { "ref": "p31", "papel": "APOYO" }
      ],
      "hecho": "El hecho con su cifra, tomado del punto marcado HECHO.",
      "contraparte": "La conducta ya observada, del punto marcado CONTRAPARTE.",
      "giro": "Que cambia al leer las dos juntas.",
      "ofreceQuien": "Quien ofrece.",
      "ofrecePrueba": "La evidencia de que ya lo hace.",
      "pagaQuien": "Quien paga.",
      "pagaPrueba": "La evidencia de que ya lo paga.",
      "negocio": "El negocio que aparece cuando las dos puntas se encuentran.",
      "limite": "Que NO se puede afirmar con estos puntos.",
      "ideas": ["Idea concreta que abre el insight.", "Otra."]
    }
  ],
  "notas": "Que no pudiste combinar y por que. Opcional."
}
\`\`\`

Los "ref" son exactamente los identificadores que se te entregan en la lista de
puntos. No inventes refs: si citas uno que no existe, el insight se descarta.`;
}

export function buildInsightUserPrompt(
  project: Pick<Project, "name" | "company">,
  brief: Brief | null,
  puntos: PuntoDisponible[],
  shape: TemplateShape,
  scope: InsightScope,
  existentes: string[],
): string {
  const nombreFila = (id: string) => shape.rows.find((r) => r.id === id)?.name ?? id;
  const nombreCol = (id: string) => shape.cols.find((c) => c.id === id)?.name ?? id;

  const partes: string[] = [];

  partes.push(`PROYECTO: ${project.name}`);
  if (project.company) partes.push(`EMPRESA: ${project.company}`);

  if (brief?.challengeText) partes.push(`\nRETO (literal de la empresa):\n${brief.challengeText}`);
  if (brief?.meta) partes.push(`\nMETA:\n${brief.meta}`);
  if (brief?.restricciones) partes.push(`\nRESTRICCIONES:\n${brief.restricciones}`);

  if (existentes.length > 0) {
    partes.push(
      `\nINSIGHTS QUE YA EXISTEN — no los repitas ni los reformules:\n` +
        existentes.map((e, i) => `${i + 1}. ${e}`).join("\n"),
    );
  }

  const filtrados = scope.dimensiones?.length
    ? puntos.filter((p) => scope.dimensiones!.includes(p.rowId))
    : puntos;

  partes.push(`\n═══ PUNTOS DISPONIBLES (${filtrados.length}) ═══`);
  let dimActual = "";
  for (const p of filtrados) {
    if (p.rowId !== dimActual) {
      dimActual = p.rowId;
      partes.push(`\n── ${nombreFila(p.rowId).toUpperCase()} ──`);
    }
    partes.push(`[${p.ref}] (${nombreCol(p.colId)} · ${p.verification}) ${p.text}`);
  }

  partes.push(
    `\n═══ ENCARGO ═══\nEntrega hasta ${scope.cuantos} insights. Menos si el mapa no da para mas: es preferible.`,
  );
  if (scope.nota) partes.push(`\nIndicacion del equipo:\n${scope.nota}`);

  return partes.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrato de salida
// ─────────────────────────────────────────────────────────────────────────────

export const InsightDotSchema = z.object({
  ref: z.string().min(1),
  papel: z.enum(["HECHO", "CONTRAPARTE", "APOYO"]).default("APOYO"),
});

export const InsightItemSchema = z.object({
  etiqueta: z.string().max(40).optional().nullable(),
  enunciado: z.string().min(40).max(1200),
  puntos: z.array(InsightDotSchema).min(DOTS_MINIMO).max(12),
  hecho: z.string().max(800).optional().nullable(),
  contraparte: z.string().max(800).optional().nullable(),
  giro: z.string().max(800).optional().nullable(),
  ofreceQuien: z.string().max(400).optional().nullable(),
  ofrecePrueba: z.string().max(600).optional().nullable(),
  pagaQuien: z.string().max(400).optional().nullable(),
  pagaPrueba: z.string().max(600).optional().nullable(),
  negocio: z.string().max(800).optional().nullable(),
  limite: z.string().max(800).optional().nullable(),
  ideas: z.array(z.string().max(400)).max(12).default([]),
});

export const InsightOutputSchema = z.object({
  insights: z.array(InsightItemSchema).max(20),
  notas: z.string().max(2000).optional().nullable(),
});

export type InsightItem = z.infer<typeof InsightItemSchema>;
export type InsightOutput = z.infer<typeof InsightOutputSchema>;
