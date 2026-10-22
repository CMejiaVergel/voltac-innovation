import "server-only";

import fs from "node:fs";
import path from "node:path";
import PptxGenJS from "pptxgenjs";

import { prisma } from "@/lib/db";
import { getPrimaryMap } from "@/lib/projects";
import { colorDeTrazo, promedioEje, ARTIFACT_KIND_LABEL, ARTIFACT_STATUS_META, asEnum, ARTIFACT_KINDS, ARTIFACT_STATUSES } from "@/lib/enums";
import { IDEX, LINEA_CONCEPTO, PREGUNTA_LIENZO } from "@/lib/gimi";
import { CAMPOS_CASO, avanceLinea, leerActuar } from "@/lib/actuar";
import { tituloPostit } from "@/lib/v2";

/**
 * Exportación a PPTX del proceso v2: el embudo de principio a fin y la línea
 * recta de cada concepto priorizado. Todo es texto y formas nativas, así que
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
  const conceptos = await prisma.concept.findMany({
    where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
    orderBy: { position: "asc" },
    include: {
      anclas: { orderBy: { position: "asc" }, include: { fragment: { select: { titulo: true, text: true } } } },
      artefactos: { orderBy: { createdAt: "asc" } },
      supuestos: { orderBy: { position: "asc" } },
    },
  });
  return { project, shape: primary?.shape ?? null, fragmentos, conceptos, soloConcepto };
}

type Datos = Awaited<ReturnType<typeof cargar>>;

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
    s.addText(titulo, { x: 0.5, y: 0.65, w: 10.8, h: 0.75, fontFace: FUENTE, fontSize: 26, bold: true, color: C.texto, valign: "top", fit: "shrink" });
    return s;
  };
  const caja = (s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, borde = C.borde) =>
    s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: C.panel }, line: { color: borde, width: 1 } });
  const bloque = (s: PptxGenJS.Slide, etiqueta: string, cuerpo: string, x: number, y: number, w: number, h: number, borde?: string) => {
    caja(s, x, y, w, h, borde);
    s.addText(
      [
        { text: etiqueta.toUpperCase(), options: { fontSize: 9, bold: true, color: C.acento, charSpacing: 2, breakLine: true } },
        { text: cuerpo || "—", options: { fontSize: 13, color: cuerpo ? C.texto : C.tenue } },
      ],
      { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: h - 0.2, fontFace: FUENTE, valign: "top", paraSpaceAfter: 4, fit: "shrink" },
    );
  };

  const priorizados = d.conceptos.filter((c) => c.priorizado && (!soloConcepto || c.id === soloConcepto));

  if (!soloConcepto) {
    portada(pptx, d, img);
    reto(lamina, bloque, d);
    embudo(pptx, lamina, d);
    if (d.shape && d.fragmentos.length) mapa(lamina, d);
    if (d.conceptos.length) matriz(pptx, lamina, d);
  }
  for (const c of priorizados) lineaDeConcepto(pptx, lamina, bloque, caja, d, c);

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  const base = soloConcepto ? priorizados[0]?.title ?? "concepto" : d.project.name;
  const nombre = `${base.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}.pptx`;
  return { buffer, nombre };
}

type Lamina = (kicker: string, titulo: string) => PptxGenJS.Slide;
type Bloque = (s: PptxGenJS.Slide, etiqueta: string, cuerpo: string, x: number, y: number, w: number, h: number, borde?: string) => void;
type Caja = (s: PptxGenJS.Slide, x: number, y: number, w: number, h: number, borde?: string) => void;

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

function reto(lamina: Lamina, bloque: Bloque, d: Datos) {
  const b = d.project.brief;
  if (!b) return;
  const s = lamina("1 · Configurar", "El reto");
  bloque(s, "Enunciado", b.challengeText, 0.5, 1.6, 12.3, 1.15);
  bloque(s, "El problema", b.problema, 0.5, 2.95, 6.05, 2.4);
  bloque(s, "Por qué motiva", b.porQueMotivante, 6.75, 2.95, 6.05, 2.4);
  bloque(s, "La meta", b.meta, 0.5, 5.55, 12.3, 1.2, C.acento);
}

function embudo(pptx: PptxGenJS, lamina: Lamina, d: Datos) {
  const s = lamina("El proceso", "De muchas ideas a un concepto en línea recta");
  const priorizados = d.conceptos.filter((c) => c.priorizado);
  const cifras: Record<string, string> = {
    configurar: d.project.brief?.meta ? "Reto definido" : "Reto en construcción",
    divergir: `${d.fragmentos.length} post-its`,
    combinar: `${d.conceptos.length} conceptos`,
    convergir: `${priorizados.length} siguen adelante`,
  };
  IDEX.filter((e) => e.key !== "actuar").forEach((e, i) => {
    const h = 3.6 - i * 0.55;
    const y = 1.7 + (3.6 - h) / 2;
    s.addShape(pptx.ShapeType.rect, { x: 0.5 + i * 1.95, y, w: 1.85, h, fill: { color: i === 3 ? "1F3330" : C.panel }, line: { color: C.acento, width: 1 } });
    s.addText(
      [
        { text: `${e.n} · ${e.name}`, options: { fontSize: 14, bold: true, color: C.texto, breakLine: true } },
        { text: e.purpose, options: { fontSize: 10, color: C.tenue, breakLine: true } },
        { text: cifras[e.key] ?? "", options: { fontSize: 12, color: C.acento } },
      ],
      { x: 0.55 + i * 1.95, y, w: 1.75, h, fontFace: FUENTE, align: "center", valign: "middle" },
    );
  });
  s.addText("5 · Actuar — cada concepto, la misma línea", { x: 8.5, y: 1.6, w: 4.4, h: 0.35, fontFace: FUENTE, fontSize: 12, bold: true, color: C.texto });
  const lineas = priorizados.length ? priorizados : [];
  if (!lineas.length) {
    s.addText("Aún no hay conceptos priorizados.", { x: 8.5, y: 2.1, w: 4.4, h: 0.4, fontFace: FUENTE, fontSize: 11, color: C.tenue });
  }
  lineas.slice(0, 5).forEach((c, k) => {
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

function mapa(lamina: Lamina, d: Datos) {
  const shape = d.shape!;
  const s = lamina("2 · Divergir", `Mapa de Oportunidades · ${d.fragmentos.length} post-its`);
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

function matriz(pptx: PptxGenJS, lamina: Lamina, d: Datos) {
  const s = lamina("4 · Convergir", "Matriz de priorización");
  const X = 0.9, Y = 1.6, L = 5.0;
  s.addShape(pptx.ShapeType.rect, { x: X, y: Y, w: L, h: L, fill: { color: C.panel }, line: { color: C.borde, width: 1 } });
  s.addShape(pptx.ShapeType.rect, { x: X + L / 2, y: Y, w: L / 2, h: L / 2, fill: { color: "1F3330" }, line: { color: C.borde, width: 0 } });
  s.addText("SEGUIR", { x: X + L - 1.3, y: Y + L / 2 - 0.35, w: 1.2, h: 0.3, fontFace: FUENTE, fontSize: 9, bold: true, color: C.acento, align: "right" });
  s.addText("Fit →", { x: X, y: Y + L + 0.05, w: L, h: 0.3, fontFace: FUENTE, fontSize: 10, color: C.suave, align: "center" });
  s.addText("Atractividad →", { x: X - 1.55, y: Y + L / 2 - 0.15, w: 2.6, h: 0.3, fontFace: FUENTE, fontSize: 10, color: C.suave, align: "center", rotate: 270 });

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
          { text: `${r.t !== null ? k + 1 : "–"}  ${corto(r.c.title, 48)}`, options: { bold: true, color: C.texto, fontSize: 13, breakLine: true } },
          {
            text: `${r.t !== null ? `Atractividad ${r.a!.toFixed(1)} · Fit ${r.f!.toFixed(1)}` : "Sin puntuar"}${r.c.priorizado ? "   ★ Sigue adelante" : ""}`,
            options: { color: r.c.priorizado ? C.oro : C.tenue, fontSize: 10 },
          },
        ],
        { x: 6.9, y: 1.6 + k * 0.62, w: 6, h: 0.58, fontFace: FUENTE, valign: "top" },
      );
    }
  });
}

function lineaDeConcepto(pptx: PptxGenJS, lamina: Lamina, bloque: Bloque, caja: Caja, d: Datos, c: Datos["conceptos"][number]) {
  const actuar = leerActuar(c.actuar);

  // El concepto y de dónde sale
  const s1 = lamina("3 · Combinar · concepto priorizado", c.title);
  s1.addText(c.statement || "—", { x: 0.5, y: 1.5, w: 12.3, h: 1.1, fontFace: FUENTE, fontSize: 15, color: C.suave, valign: "top", fit: "shrink" });
  const filas = d.shape?.rows ?? [];
  filas.forEach((r, i) => {
    const anclas = c.anclas.filter((a) => a.rowId === r.id);
    const x = 0.5 + i * 2.48;
    s1.addShape(pptx.ShapeType.rect, { x, y: 2.85, w: 2.38, h: 0.08, fill: { color: sin(r.color) }, line: { color: sin(r.color), width: 0 } });
    s1.addText(
      [
        { text: r.name, options: { bold: true, fontSize: 12, color: C.texto, breakLine: true } },
        { text: PREGUNTA_LIENZO[r.id] ?? r.facets, options: { fontSize: 9, color: C.tenue } },
      ],
      { x, y: 2.95, w: 2.38, h: 0.75, fontFace: FUENTE, valign: "top" },
    );
    anclas.slice(0, 4).forEach((a, k) => {
      const texto = a.fragment ? tituloPostit(a.fragment, 7) : tituloPostit({ titulo: "", text: a.textSnapshot }, 7);
      s1.addText(corto(texto, 60), {
        x, y: 3.8 + k * 0.72, w: 2.38, h: 0.62, fontFace: FUENTE, fontSize: 10, color: C.tinta,
        fill: { color: C.papel }, margin: 6, valign: "middle", fit: "shrink",
      });
    });
  });

  // Brochure
  const b = actuar.brochure;
  if (b.titular || b.solucion) {
    const s = lamina("5 · Actuar · Brochure", b.titular || c.title);
    bloque(s, "El problema", b.problema ?? "", 0.5, 1.6, 6.05, 2.3);
    bloque(s, "La solución", b.solucion ?? "", 6.75, 1.6, 6.05, 2.3, C.acento);
    const beneficios = (b.beneficios ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
    bloque(s, "Beneficios", beneficios.map((x) => `✓ ${x}`).join("\n"), 0.5, 4.1, 8.1, 2.6);
    bloque(s, "Llamado a la acción", b.llamado ?? "", 8.8, 4.1, 4.0, 2.6, C.oro);
  }

  // Artefactos e ingeniería inversa
  if (c.artefactos.length || c.supuestos.length) {
    const s = lamina("5 · Actuar · Artefacto e ingeniería inversa", c.title);
    caja(s, 0.5, 1.6, 6.05, 5.1);
    s.addText("ARTEFACTOS", { x: 0.65, y: 1.7, w: 5.7, h: 0.3, fontFace: FUENTE, fontSize: 9, bold: true, color: C.acento, charSpacing: 2 });
    c.artefactos.slice(0, 5).forEach((a, k) => {
      const kind = ARTIFACT_KIND_LABEL[asEnum(ARTIFACT_KINDS, a.kind, "PROTOCEPTO")];
      const st = ARTIFACT_STATUS_META[asEnum(ARTIFACT_STATUSES, a.status, "BORRADOR")];
      s.addText(
        [
          { text: corto(a.title, 50), options: { bold: true, fontSize: 13, color: C.texto, breakLine: true } },
          { text: `${kind} · ${st.label} · iteración ${a.iteration}`, options: { fontSize: 10, color: sin(st.color), breakLine: true } },
          { text: a.promise ? `«${corto(a.promise, 120)}»` : "", options: { fontSize: 10, color: C.suave } },
        ],
        { x: 0.65, y: 2.05 + k * 0.92, w: 5.75, h: 0.88, fontFace: FUENTE, valign: "top", fit: "shrink" },
      );
    });
    caja(s, 6.75, 1.6, 6.05, 5.1);
    s.addText("LO QUE TENDRÍA QUE SER CIERTO", { x: 6.9, y: 1.7, w: 5.7, h: 0.3, fontFace: FUENTE, fontSize: 9, bold: true, color: C.acento, charSpacing: 2 });
    const orden = [...c.supuestos].sort((p, q) => Number(q.critical) - Number(p.critical) || p.likelihood - q.likelihood);
    orden.slice(0, 6).forEach((sp, k) => {
      s.addText(
        [
          { text: `${sp.critical ? "★ " : ""}${corto(sp.text, 90)}`, options: { bold: sp.critical, fontSize: 11.5, color: sp.critical ? C.oro : C.texto, breakLine: true } },
          { text: sp.critical && sp.failFastTest ? `Prueba: ${corto(sp.failFastTest, 110)}` : `Probabilidad ${sp.likelihood}/5`, options: { fontSize: 9.5, color: C.suave } },
        ],
        { x: 6.9, y: 2.05 + k * 0.76, w: 5.75, h: 0.72, fontFace: FUENTE, valign: "top", fit: "shrink" },
      );
    });
  }

  // Propuesta de valor y caso de negocio
  const caso = actuar.caso;
  if (c.propuestaValor || CAMPOS_CASO.some((f) => caso[f.campo])) {
    const s = lamina("5 · Actuar · Propuesta de valor y caso de negocio", c.title);
    bloque(s, "Propuesta de valor", c.propuestaValor, 0.5, 1.6, 12.3, 1.35, C.acento);
    CAMPOS_CASO.forEach((f, i) => {
      const col = i % 3, fila = Math.floor(i / 3);
      bloque(s, f.label, caso[f.campo] ?? "", 0.5 + col * 4.15, 3.15 + fila * 1.8, 4.0, 1.65, f.campo === "siguiente" ? C.oro : undefined);
    });
  }
}
