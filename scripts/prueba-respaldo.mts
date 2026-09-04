/**
 * Prueba de ida y vuelta del respaldo, contra la base real.
 *
 *   npm run respaldo:probar [slug]
 *
 * Crea un respaldo del proyecto, lo restaura de verdad como proyecto nuevo,
 * compara todo con el original y despues borra la copia para no dejar basura.
 *
 * Sobre el apaño de aqui abajo: los modulos del servidor importan
 * `server-only`, que es un centinela — existe para reventar si alguien mete
 * codigo de servidor en un bundle de cliente. Next lo resuelve con su propio
 * alias, por eso el paquete ni siquiera esta instalado; `tsx` no lo conoce y
 * sin esto la prueba no arranca. Se neutraliza SOLO en este proceso, y las
 * importaciones son dinamicas porque un `import` normal se evalua antes que
 * cualquier codigo del modulo y el parche llegaria tarde.
 */
import Module from "node:module";

const requerir = Module.createRequire(import.meta.url);
const resolverOriginal = (
  Module as unknown as { _resolveFilename: (...a: unknown[]) => string }
)._resolveFilename;
(Module as unknown as { _resolveFilename: unknown })._resolveFilename = function (
  this: unknown,
  pedido: string,
  ...resto: unknown[]
) {
  if (pedido === "server-only") return requerir.resolve("./vacio.cjs");
  return resolverOriginal.call(this, pedido, ...resto);
};

const { prisma } = await import("../src/lib/db");
const { crearRespaldo, restaurarRespaldo } = await import("../src/lib/backup");
const { writeFileSync } = await import("node:fs");

const SLUG = process.argv[2] ?? "reuso-de-agua-de-rechazo-cabot-cartagena-prueba";

async function contar(projectId: string) {
  const map = await prisma.bomMap.findFirst({ where: { projectId } });
  return {
    fragmentos: map ? await prisma.fragment.count({ where: { mapId: map.id } }) : 0,
    revisiones: map ? await prisma.fragmentRevision.count({ where: { mapId: map.id } }) : 0,
    fuentes: await prisma.source.count({ where: { projectId } }),
    preguntas: await prisma.openQuestion.count({ where: { projectId } }),
    insights: await prisma.insight.count({ where: { projectId } }),
  };
}

const original = await prisma.project.findUnique({ where: { slug: SLUG } });
if (!original) throw new Error(`No existe el proyecto "${SLUG}"`);

const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
if (!admin) throw new Error("No hay ningun usuario ADMIN para atribuir la restauracion.");
const user = { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN" as const };

console.log(`Proyecto original: ${original.name}`);
const antes = await contar(original.id);
console.log("  ", JSON.stringify(antes));

// ── 1. Crear el respaldo ─────────────────────────────────────────────────────
const { archivo, nombre, manifiesto } = await crearRespaldo(original.id);
writeFileSync(`${process.env.TEMP ?? "."}/${nombre}`, archivo);
console.log(`\nRespaldo: ${nombre}  (${(archivo.length / 1024).toFixed(1)} KB)`);
console.log("   manifiesto:", JSON.stringify(manifiesto.conteos));

// ── 2. Restaurarlo ───────────────────────────────────────────────────────────
const restaurado = await restaurarRespaldo(user, archivo);
console.log(`\nRestaurado como: ${restaurado.nombre}  [${restaurado.slug}]`);

const copia = await prisma.project.findUnique({ where: { slug: restaurado.slug } });
const despues = await contar(copia!.id);
console.log("  ", JSON.stringify(despues));

// ── 3. Comparar ──────────────────────────────────────────────────────────────
console.log("\n--- comparacion ---");
let fallas = 0;
for (const k of Object.keys(antes) as (keyof typeof antes)[]) {
  const ok = antes[k] === despues[k];
  if (!ok) fallas++;
  console.log(`${ok ? "ok    " : "FALLA "} ${k.padEnd(12)} ${antes[k]} -> ${despues[k]}`);
}

const bA = await prisma.brief.findUnique({ where: { projectId: original.id } });
const bB = await prisma.brief.findUnique({ where: { projectId: copia!.id } });
const briefOk = bA?.challengeText === bB?.challengeText && bA?.meta === bB?.meta;
if (!briefOk) fallas++;
console.log(`${briefOk ? "ok    " : "FALLA "} brief (reto y meta identicos)`);

const mapA = await prisma.bomMap.findFirst({ where: { projectId: original.id } });
const mapB = await prisma.bomMap.findFirst({ where: { projectId: copia!.id } });
const campos = {
  orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
  select: { rowId: true, colId: true, text: true, verification: true, hidden: true },
} as const;
const fA = await prisma.fragment.findMany({ where: { mapId: mapA!.id }, ...campos });
const fB = await prisma.fragment.findMany({ where: { mapId: mapB!.id }, ...campos });
const iguales = JSON.stringify(fA) === JSON.stringify(fB);
if (!iguales) fallas++;
console.log(`${iguales ? "ok    " : "FALLA "} fragmentos (texto, celda, verificacion, oculto)`);

// Acentos: lo que mas se rompe al pasar por serializacion.
const conAcento = fB.find((f) => /[áéíóúñ—«]/.test(f.text));
if (!conAcento) fallas++;
console.log(
  `${conAcento ? "ok    " : "FALLA "} acentos preservados`,
  conAcento ? `-> "${conAcento.text.slice(0, 58)}..."` : "",
);

// Los puntos de un insight se reenlazan por mapeo de ids. Es la parte que
// puede romperse en silencio: el insight aparece pero apuntando a nada.
const conDots = {
  include: { dots: { orderBy: { position: "asc" } }, ideas: { orderBy: { position: "asc" } } },
  orderBy: { position: "asc" },
} as const;
const insA = await prisma.insight.findMany({ where: { projectId: original.id }, ...conDots });
const insB = await prisma.insight.findMany({ where: { projectId: copia!.id }, ...conDots });

if (insA.length > 0) {
  const idsB = new Set(
    (await prisma.fragment.findMany({ where: { mapId: mapB!.id }, select: { id: true } })).map(
      (f) => f.id,
    ),
  );
  let enlazados = 0;
  let rotos = 0;
  for (const i of insB) {
    for (const d of i.dots) {
      if (d.fragmentId && idsB.has(d.fragmentId)) enlazados++;
      else rotos++;
    }
  }
  const resumen = (lista: typeof insA) =>
    JSON.stringify(
      lista.map((i) => [
        i.statement,
        i.dots.map((d) => [d.textSnapshot, d.role]),
        i.ideas.map((n) => n.text),
      ]),
    );
  const mismoTexto = resumen(insA) === resumen(insB);
  if (rotos > 0 || !mismoTexto || insA.length !== insB.length) fallas++;
  console.log(
    `${rotos === 0 ? "ok    " : "FALLA "} puntos reenlazados al mapa nuevo: ${enlazados} enlazados, ${rotos} rotos`,
  );
  console.log(
    `${mismoTexto ? "ok    " : "FALLA "} insights (enunciado, puntos con su papel, ideas)`,
  );
}

// ── 4. Limpiar ───────────────────────────────────────────────────────────────
await prisma.project.delete({ where: { id: copia!.id } });
console.log(
  `\nProyecto de prueba eliminado. Original intacto: ${(await contar(original.id)).fragmentos} fragmentos.`,
);
console.log(fallas === 0 ? "\nRESULTADO: todo cuadra." : `\nRESULTADO: ${fallas} fallas.`);
process.exit(fallas === 0 ? 0 : 1);
