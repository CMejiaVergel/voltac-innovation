/**
 * Prueba de la puerta de la clave del agente.
 *
 *   npm run clave:probar
 *
 * Lo que se comprueba es una garantia de DINERO: que alguien sin clave propia
 * y sin permiso explicito no pueda gastar los creditos de quien monto la
 * instancia. Se prueba contra la base real, con usuarios de usar y tirar que
 * se borran al final.
 *
 * El apaño de `server-only` es el mismo de `prueba-respaldo.mts`: es un
 * centinela que Next resuelve con su alias y que `tsx` no conoce. Se neutraliza
 * solo en este proceso, y las importaciones van dinamicas porque un `import`
 * normal se evaluaria antes que el parche.
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

const { PrismaClient } = await import("@prisma/client");
const { claveDelAgente, estadoClaveAgente } = await import("../src/lib/claveAgente.js");
const { cifrar, pistaDe } = await import("../src/lib/secretos.js");

const prisma = new PrismaClient();

let fallos = 0;
function ok(condicion: boolean, que: string) {
  console.log(`${condicion ? "ok  " : "FALLA"} ${que}`);
  if (!condicion) fallos++;
}

/** Corre algo y dice si lanzo. */
async function lanza(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

const sufijo = Date.now();
const creados: string[] = [];

async function usuario(datos: {
  usaClaveInstancia?: boolean;
  clavePropia?: string;
}): Promise<string> {
  const u = await prisma.user.create({
    data: {
      email: `prueba-clave-${sufijo}-${creados.length}@voltac.test`,
      name: "Usuario de prueba",
      passwordHash: "x",
      usaClaveInstancia: datos.usaClaveInstancia ?? false,
      openrouterKey: datos.clavePropia ? cifrar(datos.clavePropia) : "",
      openrouterHint: datos.clavePropia ? pistaDe(datos.clavePropia) : "",
    },
    select: { id: true },
  });
  creados.push(u.id);
  return u.id;
}

try {
  const hayClaveDeInstancia = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  console.log(
    `Clave de instancia en el entorno: ${hayClaveDeInstancia ? "si" : "NO"}\n`,
  );

  // ── 1. Sin clave propia y SIN permiso: no corre. Este es el caso del mentor.
  const pelado = await usuario({});
  const e1 = await estadoClaveAgente(pelado);
  ok(e1?.puedeCorrer === false, "sin clave y sin permiso: puedeCorrer = false");
  ok(e1?.tieneClavePropia === false, "sin clave y sin permiso: no figura clave propia");
  ok(
    await lanza(() => claveDelAgente(pelado)),
    "sin clave y sin permiso: claveDelAgente LANZA (no se gasta nada)",
  );

  // ── 2. Con permiso sobre la del servidor.
  const conPermiso = await usuario({ usaClaveInstancia: true });
  const e2 = await estadoClaveAgente(conPermiso);
  ok(e2?.puedeUsarInstancia === true, "con permiso: puedeUsarInstancia = true");
  ok(
    e2?.puedeCorrer === hayClaveDeInstancia,
    `con permiso: puedeCorrer sigue al entorno (${hayClaveDeInstancia})`,
  );

  // ── 3. Clave propia: gana siempre, incluso teniendo permiso.
  const propia = "sk-or-v1-" + "b".repeat(40);
  const conPropia = await usuario({ clavePropia: propia, usaClaveInstancia: true });
  const r3 = await claveDelAgente(conPropia);
  ok(r3.origen === "PROPIA", "con clave propia y permiso: gana la PROPIA");
  ok(r3.clave === propia, "con clave propia: se descifra igual a la original");
  const e3 = await estadoClaveAgente(conPropia);
  ok(e3?.pista === pistaDe(propia), "la pista muestra solo los ultimos caracteres");
  ok(!e3?.pista?.includes(propia.slice(0, 20)), "la pista NO revela la clave");

  // ── 4. Clave guardada pero ilegible: hay que decirlo, no tratarlo como
  //      «no tiene clave», o la persona no entiende que paso.
  const rota = await usuario({});
  await prisma.user.update({
    where: { id: rota },
    data: { openrouterKey: "esto-no-descifra", openrouterHint: "····xxxx" },
  });
  const e4 = await estadoClaveAgente(rota);
  ok(e4?.claveIlegible === true, "clave ilegible: se detecta como ilegible");
  ok(e4?.puedeCorrer === false, "clave ilegible: puedeCorrer = false");
  ok(
    await lanza(() => claveDelAgente(rota)),
    "clave ilegible: claveDelAgente LANZA en vez de caer a la del servidor",
  );

  // ── 5. Ilegible Y con permiso: NO debe caer a la del servidor en silencio.
  //      Si cayera, alguien creeria estar gastando lo suyo y gastaria lo ajeno.
  const rotaConPermiso = await usuario({ usaClaveInstancia: true });
  await prisma.user.update({
    where: { id: rotaConPermiso },
    data: { openrouterKey: "tampoco-descifra", openrouterHint: "····yyyy" },
  });
  ok(
    await lanza(() => claveDelAgente(rotaConPermiso)),
    "ilegible + permiso: LANZA en vez de gastar la del servidor sin avisar",
  );
} finally {
  if (creados.length) {
    await prisma.user.deleteMany({ where: { id: { in: creados } } });
    console.log(`\nlimpieza: ${creados.length} usuarios de prueba borrados`);
  }
  await prisma.$disconnect();
}

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} comprobacion(es) fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
