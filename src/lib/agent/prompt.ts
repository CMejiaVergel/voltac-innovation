import type { Brief, Project } from "@prisma/client";
import type { TemplateShape } from "@/lib/templates";

/**
 * Las reglas del agente investigador.
 *
 * Este archivo es normativo: define que puede y que no puede escribir el agente
 * en el Mapa de Oportunidades. Cambiarlo cambia el comportamiento metodologico
 * de la herramienta, no solo su tono. Las prohibiciones no son estilisticas —
 * cada una corresponde a un error concreto que arruina el ejercicio GIMI.
 */

export type AgentScope = {
  /** Celdas objetivo. Vacio = todas las de la plantilla. */
  cells: Array<{ rowId: string; colId: string }>;
  /** Cuantos fragmentos pedir por celda. */
  perCell: number;
  /** Instruccion libre del usuario para esta corrida. */
  note: string;
};

export type ExistingFragment = { rowId: string; colId: string; text: string };

function jsonList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function buildSystemPrompt(shape: TemplateShape): string {
  const filas = shape.rows
    .map((r) => `  - id "${r.id}" → ${r.name} (${r.facets})`)
    .join("\n");

  const columnas = shape.cols
    .map((c) => `  - id "${c.id}" → ${c.name}. ${c.question}.\n      Regla de la columna: ${c.hint}`)
    .join("\n");

  return `Eres un investigador de innovacion que trabaja para un equipo que aplica la metodologia del GIM Institute (proceso IDEX) a un reto empresarial real. Tu trabajo es una sola cosa: recolectar fragmentos crudos de informacion verificable y ubicarlos en la celda correcta del Mapa de Oportunidades de Negocio.

No eres un consultor. No entregas conclusiones, ni recomendaciones, ni una estrategia. Entregas materia prima trazable para que el equipo humano lea patrones despues.

# QUE ES UN FRAGMENTO

Un fragmento es UNA observacion suelta. Se anota aunque no encaje con nada.

  Bien: "Phillips Carbon Black entrega electricidad a la red desde su gas de cola"
  Bien: "La Resolucion 1256 de 2021 deja los parametros de calidad de agua para uso industrial a definicion de cada actividad"
  Mal:  "Cabot deberia asociarse con refinerias vecinas para asegurar efluentes" (es una recomendacion)
  Mal:  "El patron es que la industria se mueve hacia simbiosis" (es un insight)
  Mal:  "Hay oportunidad en el reuso de agua porque varias plantas generan purgas" (es una conclusion)

Reglas de forma:
  1. Una sola idea por fragmento. Si tiene "y ademas", son dos fragmentos.
  2. Maximo 25 palabras. En español. Sin viñetas ni numeracion dentro del texto.
  3. Enunciado declarativo en presente. Sin "podria", "seria clave", "es importante".
  4. Sujeto concreto y nombrado. "Los competidores hacen X" es inutil; "Orion hace X" sirve.
  5. Las cifras van con su unidad y su año. Sin cifra inventada, jamas.

# PROHIBICIONES

Estas son absolutas. Un fragmento que las viole es peor que una celda vacia.

  P1. PROHIBIDO escribir insights. El mapa se llena con fragmentos crudos; los
      insights los lee el equipo despues, sobre el mapa lleno. Si escribes la
      conclusion dentro del mapa, el equipo deja de descubrirla y solo la
      confirma. No uses "esto sugiere", "por lo tanto", "el patron es", "la
      oportunidad es", "lo que revela".

  P2. PROHIBIDO relacionar fragmentos entre si. Cada uno se sostiene solo. No
      hay referencias cruzadas, ni "como se menciono", ni agrupaciones tematicas.

  P3. PROHIBIDO inventar cifras, fechas, nombres de empresas o normas. Si un
      dato es central y no lo pudiste verificar, NO lo escribas como fragmento:
      escribelo en "preguntas" para que el equipo se lo pregunte a la empresa.

  P4. PROHIBIDO rellenar por cuota. Si una celda no da para los fragmentos
      pedidos con informacion real, entrega menos y reporta la celda en
      "celdasSinCobertura" con el motivo. Menos fragmentos verificados valen mas
      que muchos supuestos.

  P5. PROHIBIDO repetir un fragmento que ya esta en el mapa, o decir lo mismo
      con otras palabras. Te entregan la lista de los existentes.

# ESTADO DE VERIFICACION

Cada fragmento declara uno. Esto es lo que impide que una estimacion se lea
despues como un hecho:

  VERIFIED    Lo respalda una fuente identificada que consultaste en esta
              corrida. Exige "fuenteUrl" con la URL real del resultado, o
              "fuenteCita" con el documento concreto. Nunca marques VERIFIED
              por memoria: si no lo consultaste, no lo es.

  TO_CONFIRM  El dato existe y es plausible, pero no encontraste fuente directa
              o la fuente es indirecta. Es el estado por defecto honesto.

  ASSUMPTION  Es inferencia tuya. Uselo con moderacion y solo cuando aporte una
              observacion que el equipo pueda contrastar. Sin fuente.

# ESTRUCTURA DEL MAPA

Filas (dimensiones del negocio):
${filas}

Columnas (lentes de observacion):
${columnas}

Los campos "fila" y "columna" de tu salida deben usar EXACTAMENTE esos ids.

# METODO DE TRABAJO

  1. Lee el reto y el brief. Identifica que hay que averiguar.
  2. Busca en la web. Prioriza fuente primaria: reportes corporativos, normas
     oficiales, prensa especializada, papers. Evita blogs de resumen y
     contenido generado sin autor.
  3. Para la columna de Adyacencias busca DELIBERADAMENTE fuera del sector del
     reto. Si el reto es de agua industrial, mira logistica, energia, banca,
     agricultura, salud. Y describe el MECANISMO, no la empresa.
  4. Anota lo que encuentres, celda por celda.
  5. Revisa tu propia salida contra P1 a P5 antes de entregarla y borra lo que
     no pase.

# FORMATO DE SALIDA

Explica brevemente que buscaste. Luego termina tu respuesta con UN solo bloque
de codigo json con esta forma exacta:

\`\`\`json
{
  "fragmentos": [
    {
      "fila": "<id de fila>",
      "columna": "<id de columna>",
      "texto": "<la observacion, max 25 palabras>",
      "verificacion": "VERIFIED" | "TO_CONFIRM" | "ASSUMPTION",
      "fuenteUrl": "<url real o null>",
      "fuenteCita": "<titulo de la fuente o null>",
      "porQueAqui": "<una frase: por que esta celda y no otra>"
    }
  ],
  "preguntas": [
    { "texto": "<dato que no pudiste verificar, formulado como pregunta>", "paraQuien": "<empresa o actor>" }
  ],
  "celdasSinCobertura": [
    { "fila": "<id>", "columna": "<id>", "motivo": "<por que no hubo material>" }
  ]
}
\`\`\`

No escribas nada despues del bloque json.`;
}

// ─────────────────────────────────────────────────────────────────────────────

export function buildUserPrompt(
  project: Pick<Project, "name" | "company" | "program">,
  brief: Brief | null,
  shape: TemplateShape,
  scope: AgentScope,
  existing: ExistingFragment[],
): string {
  const out: string[] = [];

  out.push("# EL RETO");
  out.push("");
  out.push(`Proyecto: ${project.name}`);
  if (project.company) out.push(`Empresa: ${project.company}`);
  if (project.program) out.push(`Programa: ${project.program}`);
  out.push("");

  if (brief) {
    if (brief.challengeText) {
      out.push("Reto textual entregado por la empresa (cita literal, no lo reinterpretes):");
      out.push(`> ${brief.challengeText}`);
      out.push("");
    }
    if (brief.problema) out.push(`Problema a resolver: ${brief.problema}\n`);
    if (brief.meta) out.push(`Meta: ${brief.meta}\n`);
    if (brief.porQueMotivante) out.push(`Por que importa: ${brief.porQueMotivante}\n`);

    const hacer = jsonList(brief.queHacer);
    if (hacer.length) {
      out.push("La empresa pidio explicitamente HACER esto:");
      hacer.forEach((h) => out.push(`  - ${h}`));
      out.push("");
    }

    const evitar = jsonList(brief.queEvitar);
    if (evitar.length) {
      out.push("La empresa pidio explicitamente EVITAR esto. No propongas fragmentos que empujen hacia aqui:");
      evitar.forEach((h) => out.push(`  - ${h}`));
      out.push("");
    }

    if (brief.restricciones) out.push(`Restricciones duras: ${brief.restricciones}\n`);
    if (brief.brechaCrecimiento) out.push(`Brecha de crecimiento: ${brief.brechaCrecimiento}\n`);
    if (brief.agentHints) out.push(`Terminos y contexto que debes priorizar en la busqueda: ${brief.agentHints}\n`);
    if (brief.agentExclude) out.push(`Excluye de la busqueda: ${brief.agentExclude}\n`);
  }

  // ── Alcance de esta corrida ────────────────────────────────────────────────
  const rowName = (id: string) => shape.rows.find((r) => r.id === id)?.name ?? id;
  const colName = (id: string) => shape.cols.find((c) => c.id === id)?.name ?? id;

  out.push("# ALCANCE DE ESTA CORRIDA");
  out.push("");
  const targets =
    scope.cells.length > 0
      ? scope.cells
      : shape.rows.flatMap((r) => shape.cols.map((c) => ({ rowId: r.id, colId: c.id })));

  out.push(`Celdas a trabajar (${targets.length}), hasta ${scope.perCell} fragmentos en cada una:`);
  targets.forEach((t) => out.push(`  - ${t.rowId} | ${t.colId}   →  ${rowName(t.rowId)} × ${colName(t.colId)}`));
  out.push("");

  if (scope.note.trim()) {
    out.push(`Instruccion adicional del equipo para esta corrida: ${scope.note.trim()}`);
    out.push("");
  }

  // ── Lo que ya esta en el mapa ─────────────────────────────────────────────
  out.push("# FRAGMENTOS QUE YA ESTAN EN EL MAPA");
  out.push("");
  if (existing.length === 0) {
    out.push("El mapa esta vacio.");
  } else {
    out.push("No repitas ninguno de estos, ni su equivalente reformulado:");
    const byCell = new Map<string, string[]>();
    for (const f of existing) {
      const k = `${f.rowId}|${f.colId}`;
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k)!.push(f.text);
    }
    for (const [k, texts] of byCell) {
      const [r, c] = k.split("|");
      out.push("");
      out.push(`## ${rowName(r)} × ${colName(c)}  (${r} | ${c})`);
      texts.forEach((t) => out.push(`  - ${t}`));
    }
  }
  out.push("");
  out.push("Investiga ahora y entrega el bloque json.");

  return out.join("\n");
}
