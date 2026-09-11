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
 * ANATOMIA: patron -> hecho -> implicacion, y el examen de si abre negocio
 * nuevo. Vive en `src/lib/gimi.ts` (ANATOMIA_INSIGHT) con el porque de cada
 * pieza. Lo que hay aqui abajo es esa misma regla dicha en la lengua del
 * modelo, con los ejemplos que costo conseguir.
 *
 * Cada prohibicion de este archivo corresponde a un insight concreto que se
 * cayo en revision. No son preferencias de estilo: son cicatrices.
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
con la anatomia que se define abajo.

DIMENSIONES DEL MAPA (las columnas del mapa de puntos):
${dimensiones}

LENTES (desde donde se miro cada dimension):
${lentes}

═══════════════════════════════════════════════════════════════════════
LA ANATOMIA: PATRON → HECHO → IMPLICACION
═══════════════════════════════════════════════════════════════════════

Un insight tiene TRES piezas, en este orden, y las tres tienen que estar.

1. EL PATRON — una regularidad dificilmente cuestionable.

   Algo que quien escucha reconoce como cierto sin pedir prueba. No es una
   hipotesis del equipo ni una tendencia de mercado: es una regla del mundo
   que la sala acepta al oirla.

   Se escribe EN GENERAL. Todavia no nombras a la empresa del reto.

     Bien: "En una planta de produccion industrial cada hora parada es perdida
            directa: todo lo que entra a la operacion debe estar disponible las
            24 horas."
     Bien: "Ninguna empresa industrial firma un acuerdo cuyas obligaciones
            legales no puede determinar."
     Bien: "Enfriar un efluente para poder verterlo es costo puro: no mejora el
            producto ni la produccion."
     Mal:  "El mercado del agua industrial va a crecer." (es un pronostico)
     Mal:  "Las empresas del corredor quieren colaborar." (¿como lo sabes?)

   PRUEBA: si alguien puede responder "eso depende", todavia no es un patron.

2. EL HECHO — el dato del mapa que demuestra que el patron se cumple AQUI.

   Con cifra, con actor nombrado, y tomado de un fragmento que ya esta en el
   mapa. Es la pieza que ancla el patron a este reto y a esta empresa.

     Bien: "Cabot opera al 94% de utilizacion y su agua la entrega un servicio
            publico que administra esa continuidad; el agua de rechazo no tiene
            quien la administre."

   PRUEBA: si no puedes señalar el punto del que sale, no lo escribas.

3. LA IMPLICACION — el "¿y que?".

   Lo que cambia al leer el patron y el hecho juntos, y que ninguno de los dos
   decia solo. Casi siempre es un DESPLAZAMIENTO: el problema no esta donde se
   buscaba, o el candidato no es el que parecia.

     Bien: "El obstaculo no es la calidad ni el precio: es que una interrupcion
            en la planta de al lado se convierta en una parada en la propia. Y
            eso explica por que un acuerdo entre dos plantas se queda corto."
     Bien: "El primer candidato del corredor no es quien mas agua tiene: es
            quien hoy tiene que enfriarla."

   PRUEBA: si tu implicacion se puede sustituir por el hecho sin perder nada,
   es una glosa, no un insight.

═══════════════════════════════════════════════════════════════════════
EL EXAMEN QUE DECIDE SI EL INSIGHT SE QUEDA
═══════════════════════════════════════════════════════════════════════

La implicacion tiene que ABRIR UNA OPORTUNIDAD DE NEGOCIO NUEVA. Eso va en el
campo "oportunidad" y no es opcional.

Un insight que solo reafirma la importancia del reto esta bien escrito y no
sirve para nada. La empresa ya sabe que su reto importa: por eso lo planteo.

  SE TIRA: "El agua escasea en la region y la regulacion se endurece, por lo
            que ahorrar agua es cada vez mas importante para Cabot."
            → Es el enunciado del reto con otras palabras. No abre nada.

  SE QUEDA: "A Mamonal no le falta agua: le falta alguien ante quien esos datos
             si se puedan poner. Un tercero que reciba caudales y
             caracterizaciones bajo confidencialidad y del que solo salgan
             compatibilidades."
            → Eso es un negocio que no existia en la conversacion.

Si al terminar de leerlo la empresa no ve nada que antes no viera, no lo
entregues. Es preferible entregar DOS insights que abran algo, que seis que
reafirmen el punto de partida.

═══════════════════════════════════════════════════════════════════════
PROHIBICIONES
═══════════════════════════════════════════════════════════════════════

I1. NO APORTES HECHOS QUE NO ESTEN EN EL MAPA. Tu unica fuente son los puntos
    que se te entregan. Un hecho que no paso por la verificacion del equipo no
    entra por aqui. Si te falta un dato para cerrar un insight, dilo en
    "limite" en vez de inventarlo. La unica excepcion es el PATRON, que por
    definicion es conocimiento general y no necesita fragmento — pero entonces
    tiene que ser de verdad incuestionable, no un dato disfrazado.

I2. NO AFIRMES DISPOSICION, CITA CONDUCTA. Prohibido "estarian dispuestos a",
    "les interesaria", "verian con buenos ojos", "seguramente pagarian". Solo
    vale lo que YA hicieron y consta en un fragmento.

    Ejemplo real de un insight que se cayo en revision:
      "Hay plantas dispuestas a pagar por quitarse calor de encima y, a menos
       de un kilometro, plantas que pagan combustible para producir ese mismo
       calor. Las dos pagan. Ninguna sabe de la otra."
    El mentor pregunto: ¿como sabes que ninguna sabe de la otra? ¿como sabes
    que estan dispuestas a pagar? Tres afirmaciones sin punto que las
    sostuviera. Si no puedes responder "¿como sabes eso?" señalando un punto
    concreto, no lo escribas.

I3. NO CONTRADIGAS NI INVALIDES LO QUE LA EMPRESA FIJO EXPLICITAMENTE. Las
    restricciones del brief y la lista de "que evitar" son el terreno de juego,
    no una posicion negociable. Un insight que empieza demostrandole a la
    empresa que su restriccion esta mal no se escucha: se rebate.
    Si de verdad crees que una restriccion bloquea el reto, no la ataques
    dentro del insight — anotala con "registrar_preguntas".

I4. NO TE ADELANTES A LA SOLUCION. El insight revela; no diseña. Prohibido
    prescribir el equipo, el esquema o la arquitectura ("hay que instalar un
    tanque pulmon de X m³"). Eso es la etapa Convergir y adelantarlo cierra el
    abanico antes de abrirlo. Nombra QUE falta, no COMO se construye.

I5. HABLA EN GENERAL, NO A UN DESTINATARIO. El insight lo va a leer gente que
    no estuvo en la conversacion. Nada de "como te dije", "nuestro equipo",
    "lo que buscamos". Tercera persona y sujeto nombrado.

I6. NO SEAS MAS ESPECIFICO QUE TU EVIDENCIA. Si el mapa dice "varias plantas",
    no escribas "cuatro plantas" aunque lo sepas por otro lado; si dice
    "algunas ya caracterizaron", no escribas "todas". La precision de mas es
    la que primero se cae, y arrastra el insight entero con ella.

I7. NO REPITAS EL FRAGMENTO. Si tu frase se puede sustituir por uno de los
    puntos que conecta, no hay insight: hay una glosa.

I8. DECLARA EL LIMITE. Siempre. Que es lo que NO se puede afirmar con los
    puntos que tienes. Un insight que no dice donde termina su evidencia
    invita a que se lo desmonten.

I9. NO RELLENES POR CUOTA. Si el mapa solo da para dos insights solidos,
    entrega dos y explicalo en "notas".

I10. NO ESCRIBAS DOS INSIGHTS QUE SE CONTRADIGAN. Antes de entregar, leelos
    juntos: si uno dice "ninguna fuente sola puede ser firme" y otro dice "una
    planta grande y estable es el candidato ideal", uno de los dos sobra.

═══════════════════════════════════════════════════════════════════════
COMO CONECTAR
═══════════════════════════════════════════════════════════════════════

Minimo ${DOTS_MINIMO} puntos por insight; ${DOTS_RECOMENDADO} o mas suele dar
uno mas rico. Pueden venir de dimensiones distintas o de la misma: lo que
importa es que juntos digan algo que separados no.

Papel de cada punto:

  PATRON    Muestra que la regularidad se repite. Puede no haber ninguno: un
            patron incuestionable no siempre necesita fragmento.
  HECHO     Aporta el dato duro que ancla el patron a este reto.
  APERTURA  El punto por el que asoma la oportunidad. Suele venir de
            "Adyacencias": un mecanismo que ya funciono en otro sector.
  APOYO     Refuerza, acota o matiza.

Un insight sin ningun punto HECHO no se sostiene.

BUSCA EN TODAS LAS DIMENSIONES. Si al terminar ninguno de tus insights toca una
dimension entera del mapa, dilo en "notas" con el motivo — es un hueco real que
el equipo tendra que explicar, y es mejor que lo sepa por ti.

El ORDEN de los puntos se guarda: es el recorrido del razonamiento y se dibuja
como trazo en el mapa. No lo pongas al azar.

═══════════════════════════════════════════════════════════════════════
FORMATO DE SALIDA
═══════════════════════════════════════════════════════════════════════

Razona lo que quieras antes, pero TERMINA con un unico bloque \`\`\`json con
esta forma exacta:

\`\`\`json
{
  "insights": [
    {
      "etiqueta": "Dos o tres palabras que lo identifiquen",
      "enunciado": "El parrafo completo: patron, hecho e implicacion seguidos. Tiene que leerse solo, sin el desglose.",
      "puntos": [
        { "ref": "p12", "papel": "HECHO" },
        { "ref": "p47", "papel": "APERTURA" },
        { "ref": "p31", "papel": "APOYO" }
      ],
      "patron": "La regularidad dificilmente cuestionable, escrita en general.",
      "hecho": "El dato del mapa que la demuestra aqui, con su cifra y su actor.",
      "implicacion": "El ¿y que?: lo que cambia al leer las dos juntas.",
      "oportunidad": "El negocio nuevo que abre. Si no abre ninguno, no entregues el insight.",
      "limite": "Que NO se puede afirmar con estos puntos.",
      "ideas": ["Idea concreta que abre el insight.", "Otra."]
    }
  ],
  "notas": "Que no pudiste combinar y por que. Dimensiones que quedaron fuera. Opcional."
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

  // El "que evitar" es lo que la empresa descarto por escrito. En Combinar
  // pesa mas que en Divergir: un insight que lo contradice no se corrige
  // luego, se cae entero delante del cliente.
  const evitar = listaJson(brief?.queEvitar);
  if (evitar.length > 0) {
    partes.push(
      `\nLA EMPRESA DESCARTO ESTO EXPLICITAMENTE. Es terreno de juego, no una posicion a rebatir:\n` +
        evitar.map((e) => `  - ${e}`).join("\n"),
    );
  }

  if (existentes.length > 0) {
    partes.push(
      `\nINSIGHTS QUE YA EXISTEN — no los repitas, no los reformules y no los contradigas:\n` +
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
    `\n═══ ENCARGO ═══\nEntrega hasta ${scope.cuantos} insights. Menos si el mapa no da para mas: es preferible.` +
      `\nAntes de entregar, pasa cada uno por el examen: ¿abre una oportunidad que la empresa no veia,` +
      ` o solo reafirma su propio reto? Los que solo reafirmen, descartalos y dilo en "notas".`,
  );
  if (scope.nota) partes.push(`\nIndicacion del equipo:\n${scope.nota}`);

  return partes.join("\n");
}

function listaJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contrato de salida
// ─────────────────────────────────────────────────────────────────────────────

export const InsightDotSchema = z.object({
  ref: z.string().min(1),
  papel: z.enum(["PATRON", "HECHO", "APERTURA", "APOYO"]).default("APOYO"),
});

export const InsightItemSchema = z.object({
  etiqueta: z.string().max(40).optional().nullable(),
  enunciado: z.string().min(40).max(1200),
  puntos: z.array(InsightDotSchema).min(DOTS_MINIMO).max(12),
  /** 1 — la regularidad dificilmente cuestionable. */
  patron: z.string().max(900).optional().nullable(),
  /** 2 — el dato del mapa que la demuestra en este reto. */
  hecho: z.string().max(900).optional().nullable(),
  /** 3 — el «¿y que?». */
  implicacion: z.string().max(1200).optional().nullable(),
  /** El examen: que negocio nuevo abre. */
  oportunidad: z.string().max(1200).optional().nullable(),
  limite: z.string().max(1200).optional().nullable(),
  ideas: z.array(z.string().max(400)).max(12).default([]),
});

export const InsightOutputSchema = z.object({
  insights: z.array(InsightItemSchema).max(20),
  notas: z.string().max(2000).optional().nullable(),
});

export type InsightItem = z.infer<typeof InsightItemSchema>;
export type InsightOutput = z.infer<typeof InsightOutputSchema>;
