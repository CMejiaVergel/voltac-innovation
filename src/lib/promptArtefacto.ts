/**
 * El prompt que genera un artefacto de innovacion para cualquier proyecto.
 *
 * Codifica lo que funciono con los artefactos de Cabot (brochure de dos
 * paginas, protocepto de tres hojas, mockup) despues de las correcciones del
 * mentor: estructura de cinco secciones, iconos en cada bloque, letra legible
 * impresa, hojas llenas sin huecos, cifras declaradas y cero invencion.
 *
 * Es un modulo puro: lo usan la pantalla Artefactos (para copiarlo) y la API
 * del agente (herramienta MCP `prompt_artefacto`). Los datos los reune
 * `promptArtefactoDatos.ts` en el servidor.
 */

import { ARTEFACTO, BROCHURE, ITERACIONES_ARTEFACTO, MATRIZ_ARTEFACTOS } from "@/lib/gimi";

export const FORMATOS_PROMPT = ["BROCHURE", "PROTOCEPTO", "MOCKUP"] as const;
export type FormatoPrompt = (typeof FORMATOS_PROMPT)[number];

export const FORMATO_PROMPT_LABEL: Record<FormatoPrompt, string> = {
  BROCHURE: "Brochure · 2 páginas A4",
  PROTOCEPTO: "Protocepto · 3 hojas 16:9",
  MOCKUP: "Mockup de la solución",
};

export type DatosPromptArtefacto = {
  proyecto: {
    nombre: string;
    empresa: string;
    programa: string;
    reto: string;
    meta: string;
    queEvitar: string[];
  };
  concepto: {
    titulo: string;
    frase: string;
    propuestaValor: string;
    tipo: string;
    /** Viñetas del lienzo por nombre de dimension. */
    lienzo: { dimension: string; vinetas: string[] }[];
  };
  /** Fragmentos del mapa que sostienen el concepto: los unicos hechos citables. */
  hechos: { id: string; dimension: string; texto: string; fuente: string; verificado: boolean }[];
  insights: { numero: number; patron: string; hecho: string; implicacion: string }[];
  condiciones: {
    criticas: { texto: string; prueba: string; resultado: string }[];
    otras: string[];
    precedentes: string[];
  };
};

const lista = (xs: string[], vacio = "—") => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : vacio);

function bloqueDatos(d: DatosPromptArtefacto): string {
  const p = d.proyecto;
  const c = d.concepto;
  return `## DATOS DEL PROYECTO (fuente única; no agregues otros)
- Proyecto: ${p.nombre}
- Empresa sponsor: ${p.empresa || "—"}
- Programa: ${p.programa || "—"}
- Reto tal como lo entregó la empresa: ${p.reto || "—"}
- Meta: ${p.meta || "—"}
- Lo que la empresa pidió evitar (no lo contradigas):
${lista(p.queEvitar)}

## EL CONCEPTO DE NEGOCIO
- Nombre: ${c.titulo}
- Frase (Ejercicio 1.1, «Conecte los puntos»): ${c.frase || "— (no está escrita: pídela antes de producir)"}
- Propuesta de valor: ${c.propuestaValor || "—"}
- Tipo: ${c.tipo || "—"}
- Lienzo por dimensión:
${c.lienzo.map((l) => `  · ${l.dimension}: ${l.vinetas.join("; ") || "—"}`).join("\n")}

## HECHOS CITABLES (fragmentos del mapa que sostienen el concepto)
Solo estos pueden mostrarse como «Hecho». Cita el id cuando lo uses.
${d.hechos.map((h) => `- [${h.id}] (${h.dimension}${h.verificado ? ", verificado" : ", por confirmar"}) ${h.texto}${h.fuente ? ` — fuente: ${h.fuente}` : ""}`).join("\n") || "—"}

## INSIGHTS DE LOS QUE SALE
${d.insights.map((i) => `- Insight ${i.numero}. Patrón: ${i.patron} Hecho: ${i.hecho} Implicación: ${i.implicacion}`).join("\n") || "—"}

## INGENIERÍA INVERSA
Las tres condiciones menos probables (el artefacto tiene que ponerlas a prueba):
${d.condiciones.criticas.map((x, i) => `${i + 1}. ${x.texto}\n   Prueba de falla rápida: ${x.prueba || "—"}\n   Resultado esperado: ${x.resultado || "—"}`).join("\n") || "—"}
Otras condiciones:
${lista(d.condiciones.otras)}
Se dan por sentado (precedentes; pueden usarse como contexto del problema):
${lista(d.condiciones.precedentes)}`;
}

const REGLAS_COMUNES = [
  ARTEFACTO.definicion,
  "Ejecutivo, altamente visual, conciso y convincente. Frases cortas; ningún párrafo de más de tres líneas.",
  "No inventes información, cifras, alianzas, clientes, certificaciones ni capacidades. Si falta un dato, deja el hueco señalado o pregúntalo.",
  "Cada cifra lleva una etiqueta visible de su origen: «Hecho» (solo de la lista de hechos citables), «Estimación» (cálculo propio, di la base) o «Meta» (todavía no ocurre). Ningún porcentaje de impacto se presenta como medido.",
  "No presentes el concepto como producto existente: nada de botones de ingresar, registrarse o comprar. El mockup se rotula «mockup del concepto».",
  "El llamado a la acción invita a reaccionar, no a comprar: es la prueba de falla rápida más barata de las tres condiciones.",
  "Nombra a la empresa sponsor solo si el artefacto se dirige a ella; si se dirige a terceros del ecosistema, refiérete a ella de forma genérica.",
  "Identidad visual: la marca del concepto si existe (logo, paleta, tipografía); si no, la del sponsor tomada de su logo y su sitio web. Adjunto las imágenes.",
  "Un ícono de línea sencillo en cada bloque (tarjetas, pasos, beneficios), del mismo estilo en todo el documento.",
];

const ESTRUCTURA = `## ESTRUCTURA (cinco secciones del Taller 3, en este orden)
1. **Problema** — 4 tarjetas, cada una con un dato y su origen (hecho del mapa o insight), más una franja «El costo de no resolverlo». ${BROCHURE.secciones[0].pregunta}
2. **Solución** — el nombre del concepto y la propuesta de valor; tres bloques «Propuesta de valor / Lo que sí hace / Lo que no hace»; un diagrama de cómo funciona (actores → solución → resultado); 4 pasos numerados; y un mockup de la solución en uso con un resultado de ejemplo. ${BROCHURE.secciones[1].pregunta}
3. **Diferenciación** — exactamente 3 diferenciadores, cada uno contrastado con la alternativa real de hoy («Frente a …»).
4. **Impacto** — exactamente 3 beneficios potenciales para la empresa, cada uno con un rótulo corto en mayúsculas y su etiqueta Hecho/Estimación/Meta.
5. **Equipo** — nombres, roles y fotografías (uso los que adjunto; si no hay, deja marcos vacíos con el rol) y los aliados «por sumar».
Cierre: «Lo que le pedimos hoy», tomado de la prueba de falla rápida más barata, y la leyenda Hecho / Estimación / Meta.

Preguntas que el contenido tiene que responder por dimensión:
${Object.entries(BROCHURE.porDimension).map(([d, qs]) => `- ${d}: ${qs.join(" ")}`).join("\n")}`;

const TECNICO: Record<FormatoPrompt, string> = {
  BROCHURE: `## FORMATO TÉCNICO — BROCHURE
- Un único archivo HTML autocontenido (CSS en <style>, imágenes incrustadas o por URL que yo reemplazo), sin JavaScript.
- Exactamente ${BROCHURE.paginas} hojas A4 verticales: cada hoja es un contenedor de 210 × 297 mm con overflow oculto, y \`@page { size: A4; margin: 0 }\` con salto de página entre hojas.
- Hoja 1: cabecera oscura con logo, promesa (titular) y una línea de contexto; Problema con 3 tarjetas y una fila de 4 cifras declaradas; Solución con los 4 pasos, el mockup y la franja «lo que no hace / lo que sí garantiza».
- Hoja 2: Diferenciación (3), Impacto (3, en tarjetas oscuras), Equipo (4 personas con foto, aliados por sumar, logos), y la franja final «Lo que le pedimos hoy».
- Texto base ≥ 9 pt, títulos de tarjeta ≥ 9.5 pt. Si no cabe, recorta palabras o reorganiza; nunca bajes la letra de ese mínimo.
- Pie en cada hoja con la organización y «Página N de ${BROCHURE.paginas}».`,
  PROTOCEPTO: `## FORMATO TÉCNICO — PROTOCEPTO
- Un único archivo HTML autocontenido (CSS en <style>), sin JavaScript.
- Exactamente ${BROCHURE.hojasProtocepto} láminas horizontales 16:9 de 338.6 × 190.5 mm, con \`@page { size: 338.6mm 190.5mm; margin: 0 }\`, salto de página entre láminas y overflow oculto en cada una. Así cada lámina es una página del PDF y nada se corta.
- Lámina 1 · Portada + Problema: mitad izquierda oscura (logo grande, promesa, línea de contexto, 4 cifras declaradas en rejilla 2×2); mitad derecha clara con las 4 tarjetas del problema (ícono a la izquierda, título, dato, origen) y la franja oscura del costo de no resolverlo.
- Lámina 2 · Solución: titular; tres bloques con ícono (propuesta de valor / sí hace / no hace); debajo, a la izquierda el diagrama enmarcado y los 4 pasos en 2×2 con ícono circular; a la derecha el mockup a toda la altura.
- Lámina 3 · Diferenciación (3, izquierda) + Impacto (3, derecha, en oscuro) arriba; Equipo con fotos de ≥ 27 mm y la barra «Lo que le pedimos hoy» con la leyenda de cifras abajo.
- Texto base ≥ 3.7 mm; títulos de tarjeta ≥ 1.3 em. Las tarjetas crecen hasta llenar su fila (rejilla con filas 1fr): ninguna franja vacía al pie de la lámina.
- Pie de cada lámina con logos de las organizaciones y «N / ${BROCHURE.hojasProtocepto}».`,
  MOCKUP: `## FORMATO TÉCNICO — MOCKUP
- Una sola pieza visual (HTML autocontenido o imagen) que muestre la solución funcionando en la realidad: quién la usa, en qué contexto y qué resultado obtiene.
- Si la solución es digital: la pantalla principal con datos de ejemplo verosímiles y rotulados como ejemplo. Si es física o un servicio: la escena o el proceso.
- Rotúlalo «Mockup del concepto — no hay producto en operación». No inventes funcionalidades que no estén en el concepto ni en el lienzo.
- No es una presentación: nada de diapositivas ni texto largo.`,
};

const VERIFICACION = `## ANTES DE ENTREGAR, VERIFICA
- Que el número de hojas es exacto y ningún bloque se desborda de su hoja (si puedes medir, mide).
- Que cada cifra visible tiene su etiqueta y que cada «Hecho» está en la lista de hechos citables.
- Que las tres condiciones menos probables quedan expuestas: el lector puede reaccionar a ellas.
- Que no hay botones de ingreso ni lenguaje de producto existente.

## ENTREGA
1. El archivo HTML completo.
2. Un bloque JSON con las cifras que mostraste, para declararlas en la plataforma:
   [{"valor": "…", "etiqueta": "…", "tipo": "HECHO|ESTIMACION|META", "base": "…", "fragmentoId": "… solo para HECHO"}]
3. La lista de las condiciones que el artefacto expone.

Después de probarlo con el mercado se itera: ${ITERACIONES_ARTEFACTO.ciclo.join(" → ")}, al menos ${ITERACIONES_ARTEFACTO.minimo} veces.`;

export function construirPromptArtefacto(d: DatosPromptArtefacto, formato: FormatoPrompt): string {
  const valida = (MATRIZ_ARTEFACTOS[formato === "PROTOCEPTO" ? "BROCHURE" : formato] ?? []).join(", ");
  const objetivo =
    formato === "MOCKUP"
      ? `Crea un MOCKUP visual y profesional del concepto de negocio «${d.concepto.titulo}», para que un ejecutivo entienda en segundos cómo funcionaría la solución en la realidad.`
      : `Crea un ${formato === "BROCHURE" ? "BROCHURE ejecutivo de 2 páginas" : "PROTOCEPTO de 3 hojas horizontales"} para el concepto de negocio «${d.concepto.titulo}». Es un artefacto de innovación: tiene que vender la idea y, a la vez, exponer sus condiciones más débiles a la crítica.${valida ? ` Con él se validan: ${valida.toLowerCase()}.` : ""}`;

  return [
    "# ARTEFACTO DE INNOVACIÓN — instrucciones de producción",
    objetivo,
    "Adjunto: la foto o el texto del lienzo del concepto, el logo de la marca o del sponsor, un pantallazo del sitio web del sponsor y, si las hay, las fotos del equipo.",
    bloqueDatos(d),
    `## REGLAS\n${REGLAS_COMUNES.map((r) => `- ${r}`).join("\n")}`,
    formato === "MOCKUP" ? "" : ESTRUCTURA,
    TECNICO[formato],
    VERIFICACION,
  ]
    .filter(Boolean)
    .join("\n\n");
}
