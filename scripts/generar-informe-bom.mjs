/**
 * Genera la pagina de la auditoria del mapa v2 a partir del mismo JSON que se
 * aplico al proyecto. Se genera y no se transcribe: 92 entradas escritas a
 * mano garantizan erratas y divergencia con lo que quedo en la aplicacion.
 */

import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(process.argv[2], "utf8"));
const salida = process.argv[3];

const FILAS = [
  { id: "mercado", nombre: "Mercado", facetas: "Clientes · Necesidades · Experiencias", color: "#8B9B3C" },
  { id: "entrega", nombre: "Entrega", facetas: "Ocasiones · Localidades · Canales", color: "#C97F33" },
  { id: "oferta", nombre: "Oferta", facetas: "Productos · Servicios · Marcas", color: "#9E6F72" },
  { id: "produccion", nombre: "Producción", facetas: "Competencias · Activos · Tecnologías", color: "#6B7C8C" },
  { id: "modelos", nombre: "Modelos de Negocio", facetas: "Redes y Aliados · Modelos de Precio", color: "#4E8C85" },
];

const COLUMNAS = [
  { id: "compania", nombre: "Su Compañía", pregunta: "Qué es la empresa hoy" },
  { id: "futuro", nombre: "Futuro", pregunta: "Hacia dónde va en 5 a 10 años" },
  { id: "compet", nombre: "Competidores", pregunta: "Qué hacen bien los rivales" },
  { id: "adyac", nombre: "Adyacencias", pregunta: "Qué mecanismo resolvió otra industria" },
  { id: "cadena", nombre: "Cadena de Valor", pregunta: "Quién está arriba y abajo" },
];

const VERIF = {
  VERIFIED: { etiqueta: "Verificado", corto: "VER", clase: "ver" },
  TO_CONFIRM: { etiqueta: "Por confirmar", corto: "P/C", clase: "conf" },
  ASSUMPTION: { etiqueta: "Supuesto", corto: "SUP", clase: "sup" },
};

const CORRECCIONES = [
  {
    que: "Una norma mal leída",
    antes: "«La Resolución 1256 de 2021 elimina los parámetros de calidad para uso industrial, dejándolos a definición de cada actividad.»",
    ahora: "No los elimina: los fija en la tabla de su artículo 5. Lo que derogó fue la Resolución 1207 de 2014 y sus distancias mínimas de retiro.",
    porque: "Es el error más grave de la versión anterior. Sostenía que el reuso industrial no tenía criterios de calidad definidos, y sobre esa base el equipo podría haber descartado la caracterización de efluentes como un trámite menor.",
    ids: "F76",
  },
  {
    que: "Un obstáculo legal que faltaba",
    antes: "No estaba en el mapa.",
    ahora: "El usuario receptor de aguas residuales tratadas requiere concesión de aguas; la recirculación interna del mismo generador no exige permiso.",
    porque: "Choca de frente con el «Qué Evitar» de Cabot sobre trámites legales extensos, y parte el reto en dos modelos con costos de transacción muy distintos. Que faltara hacía ver el camino más fácil de lo que es.",
    ids: "F75 · F77",
  },
  {
    que: "Adyacencias que nombraban empresas en vez de mecanismos",
    antes: "«Coca-Cola devuelve a la cuenca el agua que consume mediante programas de reposición.»",
    ahora: "«La contabilidad volumétrica de beneficios hídricos convierte una intervención en cuenca en un crédito de reposición medible.»",
    porque: "La regla de la columna pide el mecanismo trasladable, no el nombre. Saber que Coca-Cola lo hace no le sirve a nadie; saber que existe una metodología estándar que vuelve contable un beneficio difuso, sí.",
    ids: "F82",
  },
  {
    que: "Fragmentos en la fila equivocada",
    antes: "«Planta de Cartagena operando desde 1964» y «Cabot es cofundadora de la Fundación Mamonal desde 1975» vivían en Mercado.",
    ahora: "La antigüedad de la planta pasó a Producción (es un activo) y la Fundación Mamonal a Modelos de Negocio (es una red).",
    porque: "En Mercado, cuya faceta es Clientes · Necesidades · Experiencias, ninguno de los dos explicaba nada. Reubicados sí: uno condiciona qué tan fácil es intervenir el circuito, el otro es capital relacional para convencer a los vecinos.",
    ids: "F50 · F73",
  },
  {
    que: "Siete empresas en un solo papelito",
    antes: "«Vecinos del corredor: Dow, Yara, Tenaris, Esenttia, Argos, Biofilm, Ajover.»",
    ahora: "Fragmentos separados por actor, con ubicación verificable donde la hay.",
    porque: "Viola la regla de una idea por fragmento e impedía evaluar a cada vecino como candidato por separado, que es justo lo que el reto exige hacer.",
    ids: "F87 · F88 · F89",
  },
  {
    que: "Una cifra sin respaldo",
    antes: "«El agua cruda llega vía Acuacar desde el Canal del Dique, a unos 45 km.»",
    ahora: "La ruta documentada por el operador: estaciones de bombeo Dolores y Gambote con tuberías independientes.",
    porque: "Los 45 km no aparecen en ninguna fuente consultable. Una distancia inventada es peligrosa en este reto concreto, porque el costo de transporte es la variable que decide si la solución es viable.",
    ids: "F22",
  },
  {
    que: "Un dato desactualizado",
    antes: "«Kalundborg conecta 17 empresas.»",
    ahora: "16 socios, y se agregó cómo empezó: un único intercambio bilateral de agua en 1961.",
    porque: "El número estaba mal, pero lo que faltaba importa más: citado como red de 16 empresas, Kalundborg intimida; contado desde su primer acuerdo, se vuelve imitable.",
    ids: "F66 · F67",
  },
  {
    que: "Un mapa sin trazabilidad",
    antes: "110 fragmentos, 5 verificados, 0 con enlace a fuente, 0 con explicación de ubicación.",
    ahora: "92 fragmentos, 45 verificados con URL consultable, 92 con explicación de por qué viven en esa celda.",
    porque: "El mapa es un documento que el equipo va a defender ante Cabot y ante los mentores. Sin fuente por fragmento no se puede defender nada, y sin justificación de celda no se puede discutir una ubicación.",
    ids: "todo el mapa",
  },
];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const porCelda = (fila, col) => data.fragmentos.filter((f) => f.fila === fila && f.columna === col);

const cuenta = (arr, v) => arr.filter((f) => f.verificacion === v).length;

// ── Matriz resumen ──────────────────────────────────────────────────────────
const matriz = `
<div class="matriz-wrap">
<table class="matriz">
  <thead>
    <tr>
      <th class="esquina"><span>Dimensión<br>× Lente</span></th>
      ${COLUMNAS.map((c) => `<th><span class="col-n">${esc(c.nombre)}</span><span class="col-q">${esc(c.pregunta)}</span></th>`).join("")}
    </tr>
  </thead>
  <tbody>
    ${FILAS.map((r) => {
      const celdas = COLUMNAS.map((c) => {
        const items = porCelda(r.id, c.id);
        const n = items.length;
        const v = cuenta(items, "VERIFIED");
        const t = cuenta(items, "TO_CONFIRM");
        const s = cuenta(items, "ASSUMPTION");
        return `<td class="${n < 3 ? "flaca" : ""}">
          <a href="#${r.id}-${c.id}"><span class="n">${n}</span>
          <span class="barra" role="img" aria-label="${v} verificados, ${t} por confirmar, ${s} supuestos">
            ${v ? `<i class="ver" style="flex:${v}"></i>` : ""}${t ? `<i class="conf" style="flex:${t}"></i>` : ""}${s ? `<i class="sup" style="flex:${s}"></i>` : ""}
          </span></a>
        </td>`;
      }).join("");
      return `<tr><th class="fila-h" style="--rail:${r.color}"><span class="f-n">${esc(r.nombre)}</span><span class="f-f">${esc(r.facetas)}</span></th>${celdas}</tr>`;
    }).join("")}
  </tbody>
</table>
</div>`;

// ── Entradas ────────────────────────────────────────────────────────────────
const entradas = FILAS.map((r) => {
  const celdas = COLUMNAS.map((c) => {
    const items = porCelda(r.id, c.id);
    const flaca = items.length < 3;
    return `
    <section class="celda" id="${r.id}-${c.id}">
      <h3>
        <span class="celda-nombre">${esc(r.nombre)} <span class="por">×</span> ${esc(c.nombre)}</span>
        <span class="celda-meta"><code>${r.id}|${c.id}</code> · ${items.length} fragmento${items.length === 1 ? "" : "s"}${flaca ? ' · <span class="aviso">poco explorada</span>' : ""}</span>
      </h3>
      ${items
        .map(
          (f) => `
      <article class="frag">
        <div class="frag-cab">
          <code class="fid">${esc(f.id)}</code>
          <span class="chip ${VERIF[f.verificacion].clase}">${VERIF[f.verificacion].corto} ${VERIF[f.verificacion].etiqueta}</span>
          ${
            f.fuenteUrl
              ? `<a class="fuente" href="${esc(f.fuenteUrl)}" target="_blank" rel="noreferrer noopener">${esc(f.fuenteCita ?? "Fuente")}</a>`
              : `<span class="sin-fuente">sin fuente consultable</span>`
          }
        </div>
        <p class="texto">${esc(f.texto)}</p>
        <p class="razon"><span class="razon-et">Por qué aquí</span> ${esc(f.porQueAqui ?? "")}</p>
      </article>`,
        )
        .join("")}
    </section>`;
  }).join("");

  return `
  <div class="dimension" style="--rail:${r.color}">
    <h2 class="dim-h"><span class="dim-n">${esc(r.nombre)}</span><span class="dim-f">${esc(r.facetas)}</span></h2>
    ${celdas}
  </div>`;
}).join("");

const totales = {
  n: data.fragmentos.length,
  v: cuenta(data.fragmentos, "VERIFIED"),
  t: cuenta(data.fragmentos, "TO_CONFIRM"),
  s: cuenta(data.fragmentos, "ASSUMPTION"),
};

const html = `<title>Mapa de Oportunidades Cabot v2</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300..600;1,6..72,300..500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#F7F4EE; --surface:#FFFFFF; --ink:#12191C; --ink-2:#37474A;
    --muted:#6B7B78; --line:#DFD8CC; --line-2:#EDE7DC;
    --accent:#1F6E62; --accent-soft:#E2EDE9;
    --ver:#2F7D5F; --conf:#A96C13; --sup:#8E3324;
    --shadow:0 1px 2px rgba(18,25,28,.05), 0 8px 24px -12px rgba(18,25,28,.18);
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --paper:#11171A; --surface:#182023; --ink:#E9E4D9; --ink-2:#BCC7C4;
      --muted:#8B9A97; --line:#2A3438; --line-2:#212B2E;
      --accent:#6FBFB2; --accent-soft:#14312D;
      --ver:#5FB98F; --conf:#D8A24A; --sup:#D98170;
      --shadow:0 1px 2px rgba(0,0,0,.3), 0 10px 30px -14px rgba(0,0,0,.6);
    }
  }
  :root[data-theme="dark"]{
    --paper:#11171A; --surface:#182023; --ink:#E9E4D9; --ink-2:#BCC7C4;
    --muted:#8B9A97; --line:#2A3438; --line-2:#212B2E;
    --accent:#6FBFB2; --accent-soft:#14312D;
    --ver:#5FB98F; --conf:#D8A24A; --sup:#D98170;
    --shadow:0 1px 2px rgba(0,0,0,.3), 0 10px 30px -14px rgba(0,0,0,.6);
  }

  *{box-sizing:border-box}
  body{
    margin:0; background:var(--paper); color:var(--ink);
    font-family:Newsreader,Georgia,serif; font-size:17px; line-height:1.62;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1080px; margin:0 auto; padding:56px 24px 96px}
  h1,h2,h3,.ui{font-family:Archivo,"Segoe UI",system-ui,sans-serif}
  code,.mono{font-family:"IBM Plex Mono",ui-monospace,monospace}
  a{color:var(--accent)}
  :focus-visible{outline:2px solid var(--accent); outline-offset:2px; border-radius:2px}

  /* ── Cabecera ── */
  .eyebrow{font-family:"IBM Plex Mono",monospace; font-size:11px; letter-spacing:.18em;
    text-transform:uppercase; color:var(--accent); margin:0 0 14px}
  h1{font-size:clamp(30px,5vw,46px); line-height:1.05; letter-spacing:-.025em;
    font-weight:700; margin:0 0 18px; text-wrap:balance}
  .lede{font-size:19px; line-height:1.6; color:var(--ink-2); max-width:62ch; margin:0}

  .stats{display:flex; flex-wrap:wrap; gap:36px; margin:40px 0 0;
    padding:24px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line)}
  .stat b{display:block; font-family:Archivo,sans-serif; font-size:34px; font-weight:700;
    line-height:1; letter-spacing:-.02em; font-variant-numeric:tabular-nums}
  .stat span{display:block; margin-top:7px; font-family:"IBM Plex Mono",monospace;
    font-size:10.5px; letter-spacing:.13em; text-transform:uppercase; color:var(--muted)}
  .stat.acento b{color:var(--accent)}

  section.bloque{margin-top:64px}
  h2.seccion{font-size:13px; letter-spacing:.15em; text-transform:uppercase;
    font-family:"IBM Plex Mono",monospace; font-weight:500; color:var(--muted);
    margin:0 0 8px; padding-bottom:10px; border-bottom:1px solid var(--line)}
  .seccion-lede{color:var(--ink-2); max-width:62ch; margin:18px 0 0}

  /* ── Correcciones ── */
  .correcciones{display:flex; flex-direction:column; gap:2px; margin-top:28px}
  .corr{background:var(--surface); border:1px solid var(--line-2);
    border-left:3px solid var(--sup); padding:22px 24px}
  .corr h3{font-size:17px; margin:0 0 4px; letter-spacing:-.01em; font-weight:600}
  .corr .ids{font-family:"IBM Plex Mono",monospace; font-size:10.5px; color:var(--muted);
    letter-spacing:.06em}
  .corr dl{display:grid; grid-template-columns:auto 1fr; gap:6px 16px; margin:16px 0 0}
  .corr dt{font-family:"IBM Plex Mono",monospace; font-size:10px; letter-spacing:.12em;
    text-transform:uppercase; color:var(--muted); padding-top:6px}
  .corr dd{margin:0; font-size:16px; line-height:1.55; color:var(--ink-2)}
  .corr dd.ahora{color:var(--ink)}
  .corr .porque{margin:16px 0 0; padding-top:14px; border-top:1px dashed var(--line);
    font-size:16px; color:var(--ink-2)}

  /* ── Matriz ── */
  .matriz-wrap{overflow-x:auto; margin-top:28px; padding-bottom:4px}
  table.matriz{border-collapse:collapse; width:100%; min-width:760px; background:var(--surface)}
  .matriz th,.matriz td{border:1px solid var(--line-2); padding:0}
  .matriz thead th{vertical-align:bottom; padding:14px 12px; text-align:left;
    background:var(--surface); border-bottom:2px solid var(--ink)}
  .esquina span{font-family:"IBM Plex Mono",monospace; font-size:9.5px; letter-spacing:.12em;
    text-transform:uppercase; color:var(--muted); line-height:1.4}
  .col-n{display:block; font-family:Archivo,sans-serif; font-weight:600; font-size:14px;
    letter-spacing:-.01em}
  .col-q{display:block; margin-top:3px; font-size:11.5px; color:var(--muted); line-height:1.35}
  .fila-h{width:180px; padding:14px 12px; text-align:left; vertical-align:top;
    border-left:5px solid var(--rail)}
  .f-n{display:block; font-family:Archivo,sans-serif; font-weight:700; font-size:15px;
    letter-spacing:-.015em}
  .f-f{display:block; margin-top:3px; font-size:11px; color:var(--muted); line-height:1.35}
  .matriz td a{display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:9px; padding:16px 8px; text-decoration:none; color:inherit; transition:background .12s}
  .matriz td a:hover{background:var(--accent-soft)}
  .matriz td .n{font-family:Archivo,sans-serif; font-size:21px; font-weight:600;
    font-variant-numeric:tabular-nums; line-height:1}
  .barra{display:flex; width:56px; height:4px; border-radius:2px; overflow:hidden; gap:1px}
  .barra i{display:block}
  .barra .ver{background:var(--ver)} .barra .conf{background:var(--conf)} .barra .sup{background:var(--sup)}
  td.flaca{background:repeating-linear-gradient(45deg,transparent,transparent 6px,
    color-mix(in srgb,var(--conf) 12%,transparent) 6px,color-mix(in srgb,var(--conf) 12%,transparent) 12px)}
  .leyenda{display:flex; flex-wrap:wrap; gap:20px; margin-top:16px;
    font-family:"IBM Plex Mono",monospace; font-size:11px; color:var(--muted)}
  .leyenda span{display:flex; align-items:center; gap:7px}
  .leyenda i{width:16px; height:4px; border-radius:2px; display:block}

  /* ── Fragmentos ── */
  .dimension{margin-top:56px}
  .dim-h{display:flex; flex-wrap:wrap; align-items:baseline; gap:14px; margin:0 0 4px;
    padding:0 0 12px 16px; border-left:5px solid var(--rail); border-bottom:1px solid var(--line)}
  .dim-n{font-size:26px; font-weight:700; letter-spacing:-.02em}
  .dim-f{font-family:"IBM Plex Mono",monospace; font-size:11px; letter-spacing:.1em;
    text-transform:uppercase; color:var(--muted)}
  .celda{margin-top:34px; scroll-margin-top:20px}
  .celda h3{display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 14px; margin:0 0 14px}
  .celda-nombre{font-size:17px; font-weight:600; letter-spacing:-.01em}
  .celda-nombre .por{color:var(--muted); font-weight:400}
  .celda-meta{font-family:"IBM Plex Mono",monospace; font-size:10.5px; color:var(--muted);
    letter-spacing:.05em}
  .celda-meta code{background:var(--line-2); padding:2px 5px; border-radius:2px}
  .aviso{color:var(--conf)}

  .frag{background:var(--surface); border:1px solid var(--line-2); padding:18px 20px;
    margin-bottom:2px; box-shadow:var(--shadow)}
  .frag-cab{display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:11px}
  .fid{font-size:11px; font-weight:500; color:var(--muted); letter-spacing:.06em}
  .chip{font-family:"IBM Plex Mono",monospace; font-size:9.5px; letter-spacing:.1em;
    text-transform:uppercase; padding:3px 8px; border-radius:2px; white-space:nowrap}
  .chip.ver{color:var(--ver); background:color-mix(in srgb,var(--ver) 12%,transparent)}
  .chip.conf{color:var(--conf); background:color-mix(in srgb,var(--conf) 14%,transparent)}
  .chip.sup{color:var(--sup); background:color-mix(in srgb,var(--sup) 12%,transparent)}
  .fuente{font-family:Archivo,sans-serif; font-size:12px; text-decoration:none;
    border-bottom:1px solid color-mix(in srgb,var(--accent) 40%,transparent)}
  .fuente:hover{border-bottom-color:var(--accent)}
  .sin-fuente{font-family:"IBM Plex Mono",monospace; font-size:10px; color:var(--muted);
    letter-spacing:.06em}
  .texto{margin:0; font-size:18.5px; line-height:1.48; letter-spacing:-.003em}
  .razon{margin:12px 0 0; font-size:15.5px; line-height:1.58; color:var(--ink-2)}
  .razon-et{font-family:"IBM Plex Mono",monospace; font-size:9.5px; letter-spacing:.12em;
    text-transform:uppercase; color:var(--muted); margin-right:8px}

  /* ── Preguntas y fuentes ── */
  ol.preguntas{margin:26px 0 0; padding:0; list-style:none; counter-reset:p;
    display:flex; flex-direction:column; gap:2px}
  ol.preguntas li{counter-increment:p; background:var(--surface); border:1px solid var(--line-2);
    border-left:3px solid var(--conf); padding:16px 20px; display:flex; gap:16px}
  ol.preguntas li::before{content:counter(p,decimal-leading-zero);
    font-family:"IBM Plex Mono",monospace; font-size:11px; color:var(--muted); padding-top:5px}
  .q-t{display:block}
  .q-a{display:block; margin-top:5px; font-family:"IBM Plex Mono",monospace; font-size:10.5px;
    letter-spacing:.08em; text-transform:uppercase; color:var(--muted)}

  ul.fuentes{margin:26px 0 0; padding:0; list-style:none;
    display:flex; flex-direction:column; gap:20px}
  ul.fuentes li{padding-left:16px; border-left:2px solid var(--line)}
  .s-t{font-family:Archivo,sans-serif; font-weight:600; font-size:16px; letter-spacing:-.01em}
  .s-m{font-family:"IBM Plex Mono",monospace; font-size:10.5px; color:var(--muted);
    letter-spacing:.06em; margin-top:3px}
  .s-n{font-size:15.5px; color:var(--ink-2); margin-top:7px}
  .s-u{display:inline-block; margin-top:6px; font-size:12.5px; word-break:break-all}

  footer{margin-top:72px; padding-top:22px; border-top:1px solid var(--line);
    font-size:14.5px; color:var(--muted); max-width:62ch}

  @media (max-width:640px){
    body{font-size:16px}
    .wrap{padding:36px 18px 72px}
    .stats{gap:26px}
    .corr dl{grid-template-columns:1fr; gap:2px 0}
    .corr dt{padding-top:12px}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">Caribe Innova 2026 · GIMI / IDEX · Segunda versión</p>
    <h1>Mapa de Oportunidades de Negocio — Cabot Cartagena</h1>
    <p class="lede">Auditoría fragmento por fragmento del BOM del reto de reuso de agua de rechazo. Cada papelito lleva ahora su fuente consultada y la razón por la que vive en esa celda y no en otra.</p>
    <div class="stats">
      <div class="stat"><b>${totales.n}</b><span>fragmentos</span></div>
      <div class="stat acento"><b>${totales.v}</b><span>verificados con fuente</span></div>
      <div class="stat"><b>${totales.t}</b><span>por confirmar</span></div>
      <div class="stat"><b>${totales.s}</b><span>supuestos</span></div>
      <div class="stat"><b>0</b><span>celdas vacías de 25</span></div>
    </div>
  </header>

  <section class="bloque">
    <h2 class="seccion">Qué estaba mal</h2>
    <p class="seccion-lede">La versión anterior tenía 110 fragmentos y 5 verificados. El problema no era el número: era que nada se podía rastrear y varias cosas estaban mal ubicadas o mal leídas. Esto es lo que cambió y por qué importa.</p>
    <div class="correcciones">
      ${CORRECCIONES.map(
        (c) => `
      <article class="corr">
        <h3>${esc(c.que)}</h3>
        <p class="ids">${esc(c.ids)}</p>
        <dl>
          <dt>Antes</dt><dd>${esc(c.antes)}</dd>
          <dt>Ahora</dt><dd class="ahora">${esc(c.ahora)}</dd>
        </dl>
        <p class="porque">${esc(c.porque)}</p>
      </article>`,
      ).join("")}
    </div>
  </section>

  <section class="bloque">
    <h2 class="seccion">El mapa de un vistazo</h2>
    <p class="seccion-lede">Cada casilla es una celda del mapa. El número son los fragmentos; la barra reparte su estado de verificación. Las casillas rayadas tienen menos de tres y siguen siendo puntos ciegos. Pulsa cualquiera para saltar a sus fragmentos.</p>
    ${matriz}
    <div class="leyenda">
      <span><i style="background:var(--ver)"></i> Verificado con fuente consultable</span>
      <span><i style="background:var(--conf)"></i> Por confirmar</span>
      <span><i style="background:var(--sup)"></i> Supuesto del equipo</span>
    </div>
  </section>

  <section class="bloque">
    <h2 class="seccion">Los ${totales.n} fragmentos, uno por uno</h2>
    <p class="seccion-lede">Agrupados por dimensión y celda. «Por qué aquí» explica qué hace que el fragmento pertenezca a ese cruce concreto de fila y columna.</p>
    ${entradas}
  </section>

  <section class="bloque">
    <h2 class="seccion">Lo que hay que preguntarle a la empresa</h2>
    <p class="seccion-lede">Lo que no se pudo verificar no se rellenó: se convirtió en pregunta. Estas ${data.preguntas.length} salieron de la investigación y ya están cargadas en el banco de preguntas del proyecto.</p>
    <ol class="preguntas">
      ${data.preguntas
        .map(
          (q) =>
            `<li><span><span class="q-t">${esc(q.texto)}</span>${q.paraQuien ? `<span class="q-a">→ ${esc(q.paraQuien)}</span>` : ""}</span></li>`,
        )
        .join("")}
    </ol>
  </section>

  <section class="bloque">
    <h2 class="seccion">Bibliografía</h2>
    <p class="seccion-lede">Las ${data.fuentes.length} fuentes consultadas para esta versión. Toda afirmación marcada como verificada se rastrea hasta una de ellas.</p>
    <ul class="fuentes">
      ${data.fuentes
        .map(
          (s) => `<li>
        <div class="s-t">${esc(s.titulo)}</div>
        <div class="s-m">${[s.editor, s.anio].filter(Boolean).map(esc).join(" · ")}</div>
        ${s.nota ? `<div class="s-n">${esc(s.nota)}</div>` : ""}
        ${s.url ? `<a class="s-u" href="${esc(s.url)}" target="_blank" rel="noreferrer noopener">${esc(s.url)}</a>` : ""}
      </li>`,
        )
        .join("")}
    </ul>
  </section>

  <footer>
    Generado desde <code>prisma/data/bom-cabot-v2.json</code>, el mismo archivo que se aplicó al
    proyecto en la plataforma. La fuente de verdad metodológica es el material de IXL Center / GIMI:
    si algo aquí lo contradice, manda el material oficial.
  </footer>
</div>
`;

writeFileSync(salida, html, "utf8");
console.log(`escrito ${salida} — ${totales.n} fragmentos, ${data.fuentes.length} fuentes, ${data.preguntas.length} preguntas`);
