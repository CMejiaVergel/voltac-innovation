#!/usr/bin/env node
/**
 * Aplica un mapa versionado (prisma/data/bom-*.json) a un proyecto.
 *
 *   node scripts/aplicar-bom.mjs --archivo prisma/data/bom-cabot-v2.json \
 *                                --slug reuso-de-agua-de-rechazo-cabot-cartagena-prueba \
 *                                --estado ACCEPTED
 *
 * Deliberadamente NO habla con la base de datos: entra por /api/agent, la
 * misma puerta que usa el servidor MCP. Asi este script comprueba de verdad el
 * camino que despues recorre Claude Code, en vez de un atajo que no prueba nada.
 *
 * Entorno: VOLTAC_API_URL y VOLTAC_API_TOKEN.
 */

import { readFileSync } from "node:fs";

const BASE = (process.env.VOLTAC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const TOKEN = process.env.VOLTAC_API_TOKEN ?? "";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no JSON (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

const archivo = arg("archivo", "prisma/data/bom-cabot-v2.json");
const slug = arg("slug");
const estado = arg("estado", "PROPOSED");

if (!TOKEN) throw new Error("Falta VOLTAC_API_TOKEN.");
if (!slug) throw new Error("Falta --slug.");

const data = JSON.parse(readFileSync(archivo, "utf8"));

console.log(`\n  Aplicando ${archivo} sobre "${slug}" en ${BASE}`);
console.log(`  ${data.fragmentos.length} fragmentos · ${data.fuentes.length} fuentes · ${data.preguntas.length} preguntas`);
console.log(`  Estado de entrada: ${estado}\n`);

// 1. Bibliografia primero: los fragmentos se enganchan a ella por titulo/URL.
const fuentes = await api(`/api/agent/proyectos/${slug}/fuentes`, {
  method: "POST",
  body: { fuentes: data.fuentes },
});
console.log(`  fuentes nuevas: ${fuentes.creadas}`);

// 2. Fragmentos, en lotes para que un fallo no se lleve todo por delante.
let creados = 0;
const rechazados = [];
const LOTE = 20;

for (let i = 0; i < data.fragmentos.length; i += LOTE) {
  const lote = data.fragmentos.slice(i, i + LOTE).map((f) => ({
    fila: f.fila,
    columna: f.columna,
    texto: f.texto,
    verificacion: f.verificacion,
    fuenteUrl: f.fuenteUrl ?? null,
    fuenteCita: f.fuenteCita ?? null,
    porQueAqui: f.porQueAqui ?? null,
  }));

  const r = await api(`/api/agent/proyectos/${slug}/fragmentos`, {
    method: "POST",
    body: { fragmentos: lote, estado },
  });
  creados += r.creados;
  rechazados.push(...r.rechazados);
  process.stdout.write(`  fragmentos: ${creados}/${data.fragmentos.length}\r`);
}
console.log(`  fragmentos creados: ${creados}                    `);

if (rechazados.length > 0) {
  console.log(`\n  rechazados (${rechazados.length}):`);
  for (const r of rechazados) console.log(`    - ${r.motivo} :: ${r.texto.slice(0, 70)}`);
}

// 3. Preguntas pendientes.
const preguntas = await api(`/api/agent/proyectos/${slug}/preguntas`, {
  method: "POST",
  body: { preguntas: data.preguntas },
});
console.log(`  preguntas nuevas: ${preguntas.creadas}`);

// 4. Comprobacion final leyendo el estado del mapa.
const ctx = await api(`/api/agent/proyectos/${slug}`);
const vacias = ctx.celdas.filter((c) => c.aceptados + c.propuestos === 0);
const flacas = ctx.celdas.filter((c) => {
  const n = c.aceptados + c.propuestos;
  return n > 0 && n < 3;
});

console.log(`\n  Mapa resultante: ${ctx.fragmentos.length} fragmentos en ${ctx.celdas.length} celdas`);
console.log(`  celdas vacias: ${vacias.length}${vacias.length ? " → " + vacias.map((c) => c.nombre).join(", ") : ""}`);
console.log(`  celdas con menos de 3: ${flacas.length}${flacas.length ? " → " + flacas.map((c) => `${c.nombre} (${c.aceptados + c.propuestos})`).join(", ") : ""}`);

const porVerif = ctx.fragmentos.reduce((a, f) => {
  a[f.verificacion] = (a[f.verificacion] ?? 0) + 1;
  return a;
}, {});
console.log(`  verificacion: ${JSON.stringify(porVerif)}\n`);
