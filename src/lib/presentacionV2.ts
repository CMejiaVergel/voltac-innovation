import "server-only";

import fs from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";

import { prisma } from "@/lib/db";
import { getPrimaryMap } from "@/lib/projects";
import { colorDeTrazo, promedioEje, ARTIFACT_KIND_LABEL, ARTIFACT_STATUS_META, asEnum, ARTIFACT_KINDS, ARTIFACT_STATUSES } from "@/lib/enums";
import { ETAPAS_EMBUDO, LINEA_CONCEPTO, PREGUNTA_LIENZO } from "@/lib/gimi";
import { BLOQUES_CASO, CAMPOS_CASO, PLAZOS, avanceLinea, leerActuar } from "@/lib/actuar";
import { leerJsonSeguro, tituloPostit } from "@/lib/v2";
import { leerFoto, mimeDe } from "@/lib/fotos";

/**
 * Exportación a PPTX del caso de negocio (ver generarPresentacion). Todo es texto y formas nativas, así que
 * el equipo puede editar el archivo en PowerPoint antes de presentarlo.
 */

const C = {
  fondo: "12181B",
  panel: "182023",
  borde: "2A3437",
  texto: "E8E3D8",
  suave: "A9B5B3",
  tenue: "7F8F8C",
  acento: "6FBFB2",
  oro: "E8C66A",
  papel: "F4ECD6",
  tinta: "1D2224",
};
const FUENTE = "Arial";
const sin = (hex: string) => hex.replace("#", "");
/**
 * El tamaño de letra más grande (de 13 a 8 pt) con el que un texto cabe en una
 * caja. PowerPoint solo reajusta el texto cuando alguien lo edita, así que el
 * archivo tiene que salir ya ajustado. Estimación: un carácter ocupa ~0,5 em y
 * cada renglón 1,25 veces el tamaño de la letra.
 */
function tamanoQueCabe(texto: string, anchoIn: number, altoIn: number): number {
  for (const pt of [13, 12, 11, 10, 9, 8]) {
    const porRenglon = Math.max(1, Math.floor((anchoIn * 72) / (pt * 0.5)));
    const renglones = texto.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / porRenglon)), 0);
    if (renglones * pt * 1.25 <= altoIn * 72) return pt;
  }
  return 8;
}

const corto = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function logo(): string | null {
  try {
    const b = fs.readFileSync(path.join(process.cwd(), "public/brand/isotipo.png"));
    return `image/png;base64,${b.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * La marca como en el encabezado de la app: el isotipo en una baldosa blanca y
 * «VOLTAC / INNOVATION» en claro. El logo completo es azul oscuro y sobre el
 * fondo de las láminas se pierde.
 */
type ObjetoMarca =
  | { rect: PptxGenJS.ShapeProps }
  | { image: PptxGenJS.ImageProps }
  | { text: { text: string; options: PptxGenJS.TextPropsOptions } };

function marca(x: number, y: number, img: string | null, escala = 1): ObjetoMarca[] {
  const t = 0.5 * escala;
  const objetos: ObjetoMarca[] = [{ rect: { x, y, w: t, h: t, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 0 } } }];
  if (img) objetos.push({ image: { x: x + t * 0.1, y: y + t * 0.22, w: t * 0.8, h: t * 0.8 * (346 / 562), data: img } });
  objetos.push(
    { text: { text: "VOLTAC", options: { x: x + t + 0.08, y, w: 1.6 * escala, h: t * 0.6, fontFace: FUENTE, bold: true, fontSize: 14 * escala, color: C.texto, valign: "bottom", margin: 0 } } },
    { text: { text: "INNOVATION", options: { x: x + t + 0.08, y: y + t * 0.6, w: 1.6 * escala, h: t * 0.4, fontFace: FUENTE, fontSize: 7 * escala, color: C.acento, charSpacing: 3, valign: "top", margin: 0 } } },
  );
  return objetos;
}

async function cargar(slug: string, soloConcepto?: string) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { slug },
    include: { brief: true, organizacion: { select: { name: true } } },
  });
  const primary = await getPrimaryMap(project.id);
  const fragmentos = primary
    ? await prisma.fragment.findMany({
        where: { mapId: primary.map.id, reviewState: "ACCEPTED", hidden: false },
        orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
        select: { id: true, rowId: true, colId: true, titulo: true, text: true },
      })
    : [];
  const [conceptos, delProyecto, tendencias, plataforma, insights] = await Promise.all([
    prisma.concept.findMany({
      where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
      orderBy: { position: "asc" },
      include: {
        anclas: { orderBy: { position: "asc" }, include: { fragment: { select: { titulo: true, text: true } } } },
        artefactos: { orderBy: { createdAt: "asc" } },
        supuestos: { orderBy: { position: "asc" } },
      },
    }),
    prisma.membership.findMany({
      where: { projectId: project.id, user: { active: true } },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, cargo: true, formacion: true, foto: true } } },
    }),
    prisma.elementoLente.findMany({ where: { projectId: project.id, colId: "futuro" }, orderBy: { position: "asc" } }),
    prisma.plataforma.findFirst({ where: { projectId: project.id, priorizada: true }, include: { _count: { select: { fragmentos: true } } } }),
    prisma.insight.findMany({
      where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
      orderBy: { position: "asc" },
      select: { id: true, statement: true, dots: { select: { fragmentId: true } } },
    }),
  ]);
  // El equipo es la gente de la organización. Los invitados al proyecto que no
  // son de ella —mentores, evaluadores— no salen en la lámina del equipo.
  const deLaOrg = new Set(
    project.organizacionId
      ? (await prisma.orgMembership.findMany({ where: { organizacionId: project.organizacionId }, select: { userId: true } })).map((m) => m.userId)
      : [],
  );
  const miembros = delProyecto.some((m) => deLaOrg.has(m.userId)) ? delProyecto.filter((m) => deLaOrg.has(m.userId)) : delProyecto;
  // Las fotos van incrustadas: el archivo tiene que viajar solo, sin la plataforma.
  const fotos = new Map<string, string>();
  for (const m of miembros) {
    const b = m.user.foto ? await leerFoto(m.user.foto) : null;
    if (b) fotos.set(m.user.id, `${mimeDe(m.user.foto)};base64,${b.toString("base64")}`);
  }
  return { project, shape: primary?.shape ?? null, fragmentos, conceptos, soloConcepto, miembros, fotos, tendencias, plataforma, insights };
}

type Datos = Awaited<ReturnType<typeof cargar>>;
type Concepto = Datos["conceptos"][number];

/**
 * La presentación del caso de negocio. El orden es el del IMBOK (p. 72):
 * resumen ejecutivo, insight, propuesta de valor, concepto detallado, modelo
 * de negocio, tamaño del mercado, incertidumbres clave y plan de acción. Antes
 * van el equipo, el reto y el recorrido (de las ideas a la plataforma y al
 * concepto), y al final la recomendación. El proceso detallado queda en un
 * anexo. Cada lámina sale solo si tiene datos, así que sirve para cualquier
 * programa, no solo para uno.
 */
export async function generarPresentacion(slug: string, soloConcepto?: string): Promise<{ buffer: Buffer; nombre: string }> {
  const d = await cargar(slug, soloConcepto);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in
  pptx.title = d.project.name;
  pptx.company = "Voltac Innovation";

  const img = logo();
  pptx.defineSlideMaster({
    title: "V2",
    background: { color: C.fondo },
    objects: [
      ...marca(10.95, 0.35, img),
      { text: { text: d.project.name, options: { x: 0.5, y: 7.0, w: 10, h: 0.3, fontFace: FUENTE, fontSize: 9, color: C.tenue } } },
    ],
    slideNumber: { x: 12.5, y: 7.0, w: 0.5, h: 0.3, fontFace: FUENTE, fontSize: 9, color: C.tenue },
  });

  const lamina = (kicker: string, titulo: string) => {
    const s = pptx.addSlide({ masterName: "V2" });
    s.addText(kicker.toUpperCase(), { x: 0.5, y: 0.35, w: 10.5, h: 0.3, fontFace: FUENTE, fontSize: 10, color: C.acento, charSpacing: 3, bold: true });
    // Termina antes del logo; un titular largo (un eslogan) baja de tamaño para caber en una línea.
    s.addText(titulo, { x: 0.5, y: 0.65, w: 10.3, h: 0.75, fontFace: FUENTE, fontSize: titulo.length > 52 ? 21 : titulo.length > 42 ? 23 : 26, bold: true, color: C.texto, valign: "top", fit: "shrink" });
    return s;
  };
  const caja = (s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, borde = C.borde) =>
    s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: C.panel }, line: { color: borde, width: 1 } });
  const bloque = (s: PptxGenJS.Slide, etiqueta: string, cuerpo: string, x: number, y: number, w: number, h: number, borde?: string) => {
    caja(s, x, y, w, h, borde);
    s.addText(
      [
        { text: etiqueta.toUpperCase(), options: { fontSize: 9, bold: true, color: C.acento, charSpacing: 2, breakLine: true } },
        { text: cuerpo || "—", options: { fontSize: tamanoQueCabe(cuerpo, w - 0.3, h - 0.55), color: cuerpo ? C.texto : C.tenue } },
      ],
      { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: h - 0.2, fontFace: FUENTE, valign: "top", paraSpaceAfter: 4, fit: "shrink" },
    );
  };
  const k: Kit = { pptx, lamina, bloque, caja };

  const priorizados = d.conceptos.filter((c) => c.priorizado && (!soloConcepto || c.id === soloConcepto));
  const principal = priorizados[0];

  if (!soloConcepto) {
    portada(pptx, d, img);
    if (d.miembros.length) equipo(k, d);
    if (principal) resumenEjecutivo(k, principal);
    reto(k, d);
    embudo(k, d);
    if (d.tendencias.some((t) => t.tipo !== "ESCENARIO")) tendencias(k, d);
    if (d.plataforma) plataformaPriorizada(k, d);
    if (d.conceptos.length) matriz(k, d);
  }
  for (const c of priorizados) casoDeConcepto(k, d, c);
  if (!soloConcepto && principal) recomendacion(k, d, priorizados);
  if (!soloConcepto && d.shape && d.fragmentos.length) {
    separador(k, "Anexo", "El proceso en detalle");
    mapa(k, d);
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const base = soloConcepto ? priorizados[0]?.title ?? "concepto" : d.project.name;
  const nombre = `${base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}.pptx`;
  return { buffer, nombre };
}

type Lamina = (kicker: string, titulo: string) => PptxGenJS.Slide;
type Bloque = (s: PptxGenJS.Slide, etiqueta: string, cuerpo: string, x: number, y: number, w: number, h: number, borde?: string) => void;
type Caja = (s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, borde?: string) => void;
type Kit = { pptx: PptxGenJS; lamina: Lamina; bloque: Bloque; caja: Caja };

function portada(pptx: PptxGenJS, d: Datos, img: string | null) {
  const s = pptx.addSlide();
  s.background = { color: C.fondo };
  for (const o of marca(0.7, 0.7, img, 1.6)) {
    if ("rect" in o) s.addShape(pptx.ShapeType.roundRect, o.rect);
    else if ("image" in o) s.addImage(o.image);
    else s.addText(o.text.text, o.text.options);
  }
  s.addText((d.project.organizacion?.name ?? d.project.company ?? "Proyecto de innovación").toUpperCase(), {
    x: 0.7, y: 2.4, w: 11.5, h: 0.4, fontFace: FUENTE, fontSize: 12, color: C.acento, bold: true, charSpacing: 3,
  });
  s.addText(d.project.name, { x: 0.7, y: 2.85, w: 11.8, h: 1.4, fontFace: FUENTE, fontSize: 38, bold: true, color: C.texto, valign: "top", fit: "shrink" });
  if (d.project.brief?.challengeText) {
    s.addText(d.project.brief.challengeText, { x: 0.7, y: 4.4, w: 11.2, h: 1.3, fontFace: FUENTE, fontSize: 16, color: C.suave, valign: "top", fit: "shrink" });
  }
  s.addText(new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }), {
    x: 0.7, y: 6.6, w: 6, h: 0.35, fontFace: FUENTE, fontSize: 11, color: C.tenue,
  });
}

/** El equipo: foto, nombre, rol y formación de cada persona (Taller 4, lám. 37). */
function equipo({ pptx, lamina }: Kit, d: Datos) {
  const s = lamina("El equipo", "Quiénes trabajaron este reto");
  const n = Math.min(d.miembros.length, 12);
  const cols = n <= 4 ? n : n <= 8 ? 4 : 6;
  const filas = Math.ceil(n / cols);
  const ancho = 12.3 / cols;
  const alto = filas === 1 ? 4.6 : 2.6;
  const foto = Math.min(filas === 1 ? 1.9 : 1.2, ancho - 0.6);
  d.miembros.slice(0, 12).forEach((m, i) => {
    const x = 0.5 + (i % cols) * ancho;
    const y = 1.7 + Math.floor(i / cols) * alto;
    const fx = x + (ancho - foto) / 2;
    const data = d.fotos.get(m.user.id);
    if (data) s.addImage({ data, x: fx, y, w: foto, h: foto, rounding: true, sizing: { type: "cover", w: foto, h: foto } });
    else {
      s.addShape(pptx.ShapeType.ellipse, { x: fx, y, w: foto, h: foto, fill: { color: C.panel }, line: { color: C.borde, width: 1 } });
      const ini = m.user.name.split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase();
      s.addText(ini, { x: fx, y, w: foto, h: foto, fontFace: FUENTE, fontSize: 24, bold: true, color: C.suave, align: "center", valign: "middle" });
    }
    s.addText(
      [
        { text: m.user.name, options: { bold: true, fontSize: 13, color: C.texto, breakLine: true } },
        { text: m.user.cargo || "", options: { fontSize: 10.5, color: C.acento, breakLine: true } },
        { text: corto(m.user.formacion || "", filas === 1 ? 180 : 90), options: { fontSize: 9, color: C.suave } },
      ],
      { x: x + 0.05, y: y + foto + 0.08, w: ancho - 0.1, h: alto - foto - 0.2, fontFace: FUENTE, align: "center", valign: "top", fit: "shrink" },
    );
  });
}

/** Si tuviera 90 segundos (Taller 4, lám. 19; IMBOK p. 72: se empieza por el resumen). */
function resumenEjecutivo({ lamina, bloque }: Kit, c: Concepto) {
  const caso = leerActuar(c.actuar).caso;
  if (!caso.resumen && !c.propuestaValor) return;
  const s = lamina("Resumen ejecutivo", caso.eslogan || c.title);
  bloque(s, "En 90 segundos", caso.resumen ?? "", 0.5, 1.6, 12.3, 3.3, C.acento);
  bloque(s, "Concepto recomendado", c.title, 0.5, 5.1, 4.0, 1.6);
  bloque(s, "Propuesta de valor", c.propuestaValor, 4.7, 5.1, 8.1, 1.6);
}

function reto({ lamina, bloque }: Kit, d: Datos) {
  const b = d.project.brief;
  if (!b) return;
  const s = lamina("El reto", "Lo que nos propusimos resolver");
  bloque(s, "Enunciado", b.challengeText, 0.5, 1.6, 12.3, 1.15);
  bloque(s, "El problema", b.problema, 0.5, 2.95, 6.05, 2.4);
  bloque(s, "Por qué motiva", b.porQueMotivante, 6.75, 2.95, 6.05, 2.4);
  bloque(s, "La meta", b.meta, 0.5, 5.55, 12.3, 1.2, C.acento);
}

/** El mapa del recorrido: de las ideas a la plataforma y al concepto. */
function embudo({ pptx, lamina }: Kit, d: Datos) {
  const s = lamina("Mapa del recorrido", "De muchas ideas a un concepto en línea recta");
  const priorizados = d.conceptos.filter((c) => c.priorizado);
  const cifras: Record<string, string> = {
    configurar: d.project.brief?.meta ? "Reto definido" : "Reto en construcción",
    divergir: `${d.fragmentos.length} post-its · ${d.insights.length} insights`,
    plataformas: d.plataforma ? `★ ${corto(d.plataforma.nombre, 40)}` : "",
    combinar: `${d.conceptos.length} conceptos`,
    convergir: `${priorizados.length} siguen adelante`,
  };
  ETAPAS_EMBUDO.forEach((e, i) => {
    const h = 3.6 - i * 0.45;
    const y = 1.7 + (3.6 - h) / 2;
    s.addShape(pptx.ShapeType.rect, { x: 0.5 + i * 1.6, y, w: 1.5, h, fill: { color: i === ETAPAS_EMBUDO.length - 1 ? "1F3330" : C.panel }, line: { color: C.acento, width: 1 } });
    s.addText(
      [
        { text: e.name, options: { fontSize: 13, bold: true, color: C.texto, breakLine: true } },
        { text: e.purpose, options: { fontSize: 10, color: C.tenue, breakLine: true } },
        { text: cifras[e.key] ?? "", options: { fontSize: 11, color: C.acento } },
      ],
      { x: 0.55 + i * 1.6, y, w: 1.4, h, fontFace: FUENTE, align: "center", valign: "middle", fit: "shrink" },
    );
  });
  s.addText("Actuar — cada concepto, la misma línea", { x: 8.5, y: 1.6, w: 4.4, h: 0.35, fontFace: FUENTE, fontSize: 12, bold: true, color: C.texto });
  if (!priorizados.length) {
    s.addText("Aún no hay conceptos priorizados.", { x: 8.5, y: 2.1, w: 4.4, h: 0.4, fontFace: FUENTE, fontSize: 11, color: C.tenue });
  }
  priorizados.slice(0, 5).forEach((c, k) => {
    const y = 2.3 + k * 0.85;
    const pasos = avanceLinea({ actuar: c.actuar, propuestaValor: c.propuestaValor, artefactos: c.artefactos, supuestos: c.supuestos });
    s.addText(corto(c.title, 34), { x: 8.5, y, w: 4.4, h: 0.3, fontFace: FUENTE, fontSize: 11, color: C.suave });
    s.addShape(pptx.ShapeType.line, { x: 8.65, y: y + 0.5, w: 3.9, h: 0, line: { color: C.borde, width: 1 } });
    LINEA_CONCEPTO.forEach((p, j) => {
      const hecho = pasos[p.key];
      s.addShape(pptx.ShapeType.ellipse, {
        x: 8.55 + j * 0.97, y: y + 0.4, w: 0.2, h: 0.2,
        fill: { color: hecho ? C.acento : C.fondo }, line: { color: hecho ? C.acento : C.tenue, width: 1 },
      });
    });
  });
  s.addText(LINEA_CONCEPTO.map((p) => p.nombre).join("  ·  "), { x: 8.5, y: 6.45, w: 4.6, h: 0.35, fontFace: FUENTE, fontSize: 8, color: C.tenue });
}

/** Tendencias de la hoja de Futuro, de mayor a menor impacto (Taller 4, lám. 40). */
function tendencias({ lamina, bloque }: Kit, d: Datos) {
  const lista = d.tendencias
    .filter((t) => t.tipo !== "ESCENARIO")
    .sort((a, b) => (b.impacto ?? 0) - (a.impacto ?? 0) || (b.incertidumbre ?? 0) - (a.incertidumbre ?? 0));
  const escenarios = d.tendencias.filter((t) => t.tipo === "ESCENARIO");
  const s = lamina("Tendencias de la industria", "Las fuerzas que mueven la oportunidad");
  const texto = lista
    .slice(0, 10)
    .map(
      (t) =>
        `${t.eje ? "★ " : "• "}${t.nombre}${t.impacto ? `  (impacto ${t.impacto}${t.incertidumbre ? `, incertidumbre ${t.incertidumbre}` : ""})` : ""}` +
        (t.detalle ? `\n   ${corto(t.detalle, escenarios.length ? 150 : 260)}` : ""),
    )
    .join("\n");
  bloque(s, "Tendencias principales", texto, 0.5, 1.6, escenarios.length ? 6.05 : 12.3, 5.1, C.acento);
  if (escenarios.length) {
    bloque(s, "Escenarios a 5 años", escenarios.map((e) => `${e.nombre}${e.detalle ? `: ${corto(e.detalle, 160)}` : ""}`).join("\n\n"), 6.75, 1.6, 6.05, 5.1);
  }
}

/** La plataforma de crecimiento donde vive el concepto (IMBOK pp. 58-59). */
function plataformaPriorizada({ lamina, bloque }: Kit, d: Datos) {
  const p = d.plataforma!;
  const des = leerJsonSeguro<Record<string, string>>(p.desarrollo, {});
  const s = lamina("Plataforma de crecimiento", p.nombre);
  bloque(s, "Propuesta de valor", des.propuesta ?? "", 0.5, 1.6, 12.3, 1.3, C.acento);
  bloque(s, "Insights y habilitadores", des.insights ?? "", 0.5, 3.1, 6.05, 1.75);
  bloque(s, "Segmentos y dinámica competitiva", des.segmentos ?? "", 6.75, 3.1, 6.05, 1.75);
  bloque(s, "Activos y aliados", des.activos ?? "", 0.5, 5.05, 6.05, 1.65);
  bloque(s, "Por qué podemos ganar", des.ganar ?? "", 6.75, 5.05, 6.05, 1.65);
}

function separador({ lamina }: Kit, kicker: string, titulo: string) {
  lamina(kicker, titulo);
}

function mapa({ lamina }: Kit, d: Datos) {
  const shape = d.shape!;
  const s = lamina("Anexo · Mapa de oportunidades", `${d.fragmentos.length} post-its`);
  const filas: PptxGenJS.TableRow[] = [
    [{ text: "", options: { fill: { color: C.fondo } } }, ...shape.cols.map((c) => ({ text: c.name, options: { bold: true, color: C.texto, fill: { color: C.panel }, fontSize: 10 } }))],
    ...shape.rows.map((r) => [
      { text: r.name, options: { bold: true, color: C.tinta, fill: { color: sin(r.color) }, fontSize: 10, valign: "middle" as const } },
      ...shape.cols.map((c) => {
        const ps = d.fragmentos.filter((f) => f.rowId === r.id && f.colId === c.id);
        const titulos = ps.slice(0, 3).map((p) => `• ${corto(tituloPostit(p, 6), 42)}`);
        if (ps.length > 3) titulos.push(`+${ps.length - 3} más`);
        return { text: titulos.join("\n") || "—", options: { color: ps.length ? C.suave : C.tenue, fill: { color: C.panel }, fontSize: 7.5, valign: "top" as const } };
      }),
    ]),
  ];
  s.addTable(filas, {
    x: 0.5, y: 1.55, w: 12.3, colW: [1.6, ...shape.cols.map(() => 10.7 / shape.cols.length)],
    rowH: [0.35, ...shape.rows.map(() => 0.98)], fontFace: FUENTE, border: { type: "solid", color: C.borde, pt: 1 }, margin: 4,
  });
}

/** Conceptos identificados y el elegido, en la matriz atractivo × encaje. */
function matriz({ pptx, lamina }: Kit, d: Datos) {
  const s = lamina("Conceptos de negocio", "Conceptos identificados y concepto elegido");
  const X = 0.9, Y = 1.6, L = 5.0;
  s.addShape(pptx.ShapeType.rect, { x: X, y: Y, w: L, h: L, fill: { color: C.panel }, line: { color: C.borde, width: 1 } });
  s.addShape(pptx.ShapeType.rect, { x: X + L / 2, y: Y, w: L / 2, h: L / 2, fill: { color: "1F3330" }, line: { color: C.borde, width: 0 } });
  s.addText("ALTA PRIORIDAD", { x: X + L - 1.9, y: Y + L / 2 - 0.35, w: 1.8, h: 0.3, fontFace: FUENTE, fontSize: 9, bold: true, color: C.acento, align: "right" });
  s.addText("Encaje →", { x: X, y: Y + L + 0.05, w: L, h: 0.3, fontFace: FUENTE, fontSize: 10, color: C.suave, align: "center" });
  s.addText("Atractivo →", { x: X - 1.55, y: Y + L / 2 - 0.15, w: 2.6, h: 0.3, fontFace: FUENTE, fontSize: 10, color: C.suave, align: "center", rotate: 270 });

  const conTotal = d.conceptos.map((c, i) => {
    const a = promedioEje(c, "atractividad");
    const f = promedioEje(c, "fit");
    return { c, i, a, f, t: a !== null && f !== null ? (a + f) / 2 : null };
  });
  const ranking = [...conTotal].sort((p, q) => (q.t ?? -1) - (p.t ?? -1));
  ranking.forEach((r, k) => {
    const color = sin(colorDeTrazo(r.c.color, r.i));
    if (r.a !== null && r.f !== null) {
      const P = 0.35, U = L - 2 * P;
      const cx = X + P + ((r.f - 1) / 4) * U, cy = Y + L - P - ((r.a - 1) / 4) * U;
      s.addShape(pptx.ShapeType.ellipse, { x: cx - 0.2, y: cy - 0.2, w: 0.4, h: 0.4, fill: { color }, line: { color: r.c.priorizado ? C.oro : C.fondo, width: r.c.priorizado ? 2.5 : 1 } });
      s.addText(String(k + 1), { x: cx - 0.2, y: cy - 0.2, w: 0.4, h: 0.4, fontFace: FUENTE, fontSize: 11, bold: true, color: C.tinta, align: "center", valign: "middle" });
    }
    if (k < 8) {
      s.addText(
        [
          { text: `${r.t !== null ? k + 1 : "–"}  ${corto(r.c.title, 66)}`, options: { bold: true, color: C.texto, fontSize: 12, breakLine: true } },
          {
            text: `${r.t !== null ? `Atractivo ${r.a!.toFixed(1)} · Encaje ${r.f!.toFixed(1)}` : "Sin puntuar"}${r.c.priorizado ? "   ★ Elegido" : ""}`,
            options: { color: r.c.priorizado ? C.oro : C.tenue, fontSize: 10 },
          },
        ],
        { x: 6.9, y: 1.6 + k * 0.62, w: 6, h: 0.58, fontFace: FUENTE, valign: "top" },
      );
    }
  });
}

/**
 * El caso de negocio de un concepto, en el orden del IMBOK (p. 72): insight,
 * propuesta de valor, concepto detallado, modelo de negocio y tamaño,
 * incertidumbres clave y plan de acción.
 */
function casoDeConcepto(k: Kit, d: Datos, c: Concepto) {
  const { pptx, lamina, bloque, caja } = k;
  const actuar = leerActuar(c.actuar);
  const caso = actuar.caso;
  const kick = (t: string) => `Caso de negocio · ${t}`;

  // 1. Insight: el «¡ajá!» y los insights que comparten post-its con el concepto
  const ids = new Set(c.anclas.map((a) => a.fragmentId).filter(Boolean));
  const respaldo = d.insights.filter((i) => i.dots.some((x) => x.fragmentId && ids.has(x.fragmentId)));
  if (caso.aja || respaldo.length) {
    const s = lamina(kick("Insight"), c.title);
    bloque(s, "El «¡ajá!»", caso.aja ?? "", 0.5, 1.6, 12.3, 2.3, C.oro);
    bloque(s, "Insights que lo respaldan", respaldo.map((i) => `• ${i.statement}`).join("\n"), 0.5, 4.1, 12.3, 2.6);
  }

  // 2. Propuesta de valor
  if (c.propuestaValor || caso.beneficios) {
    const s = lamina(kick("Propuesta de valor"), c.title);
    bloque(s, "Propuesta de valor", c.propuestaValor, 0.5, 1.6, 12.3, 2.4, C.acento);
    bloque(s, "Beneficios y quién los obtiene", caso.beneficios ?? "", 0.5, 4.2, 12.3, 2.5);
  }

  // 3. Concepto detallado: los puntos que conecta, la descripción y su visualización
  const s1 = lamina(kick("Concepto detallado"), c.title);
  const frase = caso.descripcion || c.statement || "—";
  const tam = frase.length < 220 ? 15 : frase.length < 480 ? 12.5 : frase.length < 760 ? 11 : 9.5;
  s1.addText(frase, { x: 0.5, y: 1.45, w: 12.3, h: 1.75, fontFace: FUENTE, fontSize: tam, color: C.suave, valign: "top" });
  (d.shape?.rows ?? []).forEach((r, i) => {
    const anclas = c.anclas.filter((a) => a.rowId === r.id);
    const x = 0.5 + i * 2.48;
    s1.addShape(pptx.ShapeType.rect, { x, y: 3.3, w: 2.38, h: 0.08, fill: { color: sin(r.color) }, line: { color: sin(r.color), width: 0 } });
    s1.addText(
      [
        { text: r.name, options: { bold: true, fontSize: 12, color: C.texto, breakLine: true } },
        { text: PREGUNTA_LIENZO[r.id] ?? r.facets, options: { fontSize: 9, color: C.tenue } },
      ],
      { x, y: 3.4, w: 2.38, h: 0.6, fontFace: FUENTE, valign: "top" },
    );
    if (anclas.length > 4) s1.addText(`+${anclas.length - 4} más`, { x, y: 6.6, w: 2.38, h: 0.3, fontFace: FUENTE, fontSize: 9, color: C.tenue });
    anclas.slice(0, 4).forEach((a, j) => {
      const texto = a.fragment ? tituloPostit(a.fragment, 7) : tituloPostit({ titulo: "", text: a.textSnapshot }, 7);
      s1.addText(corto(texto, 60), {
        x, y: 4.1 + j * 0.62, w: 2.38, h: 0.54, fontFace: FUENTE, fontSize: 10, color: C.tinta,
        fill: { color: C.papel }, margin: 6, valign: "middle", fit: "shrink",
      });
    });
  });
  const b = actuar.brochure;
  if (b.titular || b.solucion) {
    const s = lamina(kick("Brochure"), b.titular || c.title);
    bloque(s, "¿Cuál es la necesidad?", b.problema ?? "", 0.5, 1.6, 6.05, 2.3);
    bloque(s, "¿Cuál es la solución?", b.solucion ?? "", 6.75, 1.6, 6.05, 2.3, C.acento);
    const beneficios = (b.beneficios ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
    bloque(s, "¿Por qué nosotros?", beneficios.map((x) => `✓ ${x}`).join("\n"), 0.5, 4.1, 8.1, 2.6);
    bloque(s, "Llamado a la acción", b.llamado ?? "", 8.8, 4.1, 4.0, 2.6, C.oro);
  }

  // 4 y 5. Modelo de negocio y tamaño de la oportunidad; stakeholders
  laminaDeBloque(k, c, "modelo", kick("Modelo de negocio y tamaño"));
  laminaDeBloque(k, c, "stakeholders", kick("Stakeholders"));

  // 6. Incertidumbres clave: riesgos y la ingeniería inversa
  laminaDeBloque(k, c, "riesgos", kick("Riesgos y opciones"));
  if (c.artefactos.length || c.supuestos.length) {
    const s = lamina(kick("Incertidumbres clave"), c.title);
    caja(s, 0.5, 1.6, 6.05, 5.1);
    s.addText("LO QUE TENDRÍA QUE SER CIERTO", { x: 0.65, y: 1.7, w: 5.7, h: 0.3, fontFace: FUENTE, fontSize: 9, bold: true, color: C.acento, charSpacing: 2 });
    // Las críticas van completas, con su prueba y su resultado; los precedentes
    // no son incertidumbres (el proceso ya los dio por sentados) y no entran.
    const condiciones = c.supuestos.filter((sp) => sp.kind !== "PRECEDENTE");
    const criticas = condiciones.filter((sp) => sp.critical).slice(0, 3);
    criticas.forEach((sp, j) => {
      s.addText(
        [
          { text: `★ ${corto(sp.text, 230)}`, options: { bold: true, fontSize: 10.5, color: C.oro, breakLine: true } },
          { text: sp.failFastTest ? `Prueba: ${corto(sp.failFastTest, 150)}` : "Prueba por definir", options: { fontSize: 9.5, color: C.suave, breakLine: true } },
          { text: sp.expectedResult ? `Resultado esperado: ${corto(sp.expectedResult, 180)}` : "", options: { fontSize: 9.5, color: C.acento } },
        ],
        { x: 0.65, y: 2.05 + j * 1.3, w: 5.75, h: 1.25, fontFace: FUENTE, valign: "top", fit: "shrink" },
      );
    });
    const otras = condiciones.filter((sp) => !sp.critical).sort((p, q) => p.likelihood - q.likelihood);
    if (otras.length) {
      s.addText(
        otras.slice(0, 3).map((sp) => ({ text: `• ${corto(sp.text, 110)}`, options: { fontSize: 9, color: C.suave, breakLine: true } })),
        { x: 0.65, y: 2.05 + criticas.length * 1.3, w: 5.75, h: 6.6 - (2.05 + criticas.length * 1.3), fontFace: FUENTE, valign: "top", fit: "shrink" },
      );
    }
    caja(s, 6.75, 1.6, 6.05, 5.1);
    s.addText("ARTEFACTOS PARA VALIDARLO", { x: 6.9, y: 1.7, w: 5.7, h: 0.3, fontFace: FUENTE, fontSize: 9, bold: true, color: C.acento, charSpacing: 2 });
    // Los más recientes primero; los borradores solo si no hay otra cosa que mostrar.
    const recientes = [...c.artefactos].reverse();
    const vigentes = recientes.some((a) => a.status !== "BORRADOR") ? recientes.filter((a) => a.status !== "BORRADOR") : recientes;
    vigentes.slice(0, 5).forEach((a, j) => {
      const kind = ARTIFACT_KIND_LABEL[asEnum(ARTIFACT_KINDS, a.kind, "PROTOCEPTO")];
      const st = ARTIFACT_STATUS_META[asEnum(ARTIFACT_STATUSES, a.status, "BORRADOR")];
      s.addText(
        [
          { text: corto(a.title, 50), options: { bold: true, fontSize: 13, color: C.texto, breakLine: true } },
          { text: `${kind} · ${st.label} · iteración ${a.iteration}`, options: { fontSize: 10, color: sin(st.color), breakLine: true } },
          { text: a.promise ? `«${corto(a.promise, 120)}»` : "", options: { fontSize: 10, color: C.suave } },
        ],
        { x: 6.9, y: 2.05 + j * 0.92, w: 5.75, h: 0.88, fontFace: FUENTE, valign: "top", fit: "shrink" },
      );
    });
  }

  // 7. Plan de acción
  const filas = actuar.plan.filter((f) => f.que);
  if (filas.length) {
    const s = lamina(kick("Plan de acción"), c.title);
    const plazo = (x: string) => PLAZOS.find((p) => p.key === x)?.label ?? "";
    s.addTable(
      [
        ["Qué", "Cómo", "Quién", "Cuándo", "Plazo"].map((t) => ({ text: t, options: { bold: true, color: C.acento, fontSize: 11 } })),
        ...filas.slice(0, 10).map((f) => [f.que, f.como, f.quien, f.cuando, plazo(f.plazo)].map((t) => ({ text: corto(t, 160), options: { color: C.texto, fontSize: 10 } }))),
      ],
      { x: 0.5, y: 1.6, w: 12.3, colW: [3.2, 4.1, 2.0, 1.5, 1.5], fontFace: FUENTE, border: { type: "solid", color: C.borde, pt: 0.75 }, fill: { color: C.panel } },
    );
  }

  laminaDeBloque(k, c, "discurso", kick("Discurso"));
}

/** Una lámina con los campos llenos de un bloque del caso. */
function laminaDeBloque({ lamina, bloque }: Kit, c: Concepto, clave: (typeof BLOQUES_CASO)[number]["key"], kicker: string) {
  const caso = leerActuar(c.actuar).caso;
  const campos = CAMPOS_CASO.filter((f) => f.bloque === clave && caso[f.campo]);
  if (!campos.length) return;
  const s = lamina(kicker, c.title);
  const cols = campos.length === 1 ? 1 : campos.length <= 4 ? 2 : 3;
  const filas = Math.ceil(campos.length / cols);
  const w = (12.3 - (cols - 1) * 0.2) / cols;
  const h = (5.1 - (filas - 1) * 0.2) / filas;
  campos.forEach((f, i) => {
    const col = i % cols, fila = Math.floor(i / cols);
    bloque(s, f.label, caso[f.campo] ?? "", 0.5 + col * (w + 0.2), 1.6 + fila * (h + 0.2), w, h, f.campo === "indicadores" ? C.oro : undefined);
  });
}

/** Cierre: la recomendación y los próximos pasos (Taller 4, lám. 47). */
function recomendacion({ lamina, bloque }: Kit, d: Datos, priorizados: Concepto[]) {
  const c = priorizados[0];
  const actuar = leerActuar(c.actuar);
  const pasos = actuar.plan.filter((f) => f.que && f.plazo === "CORTO").map((f) => `• ${f.que}${f.quien ? ` — ${f.quien}` : ""}${f.cuando ? ` (${f.cuando})` : ""}`);
  const pruebas = c.supuestos.filter((s) => s.critical).map((s) => `• ${corto(s.text, 220)}`);
  const s = lamina("Resumen y recomendación", `Recomendamos: ${c.title}`);
  bloque(s, "Por qué", actuar.caso.resumen || c.propuestaValor, 0.5, 1.6, 12.3, 2.0, C.acento);
  bloque(s, "Próximos pasos", pasos.join("\n"), 0.5, 3.8, 6.05, 2.9);
  bloque(s, "Hipótesis por probar primero", pruebas.join("\n"), 6.75, 3.8, 6.05, 2.9, C.oro);
  if (priorizados.length > 1) {
    s.addText(`También siguen adelante: ${priorizados.slice(1).map((x) => x.title).join(" · ")}`, { x: 0.5, y: 6.75, w: 12.3, h: 0.25, fontFace: FUENTE, fontSize: 9, color: C.tenue });
  }
}
