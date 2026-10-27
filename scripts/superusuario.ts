/**
 * Administradores de la instancia, SOLO desde la terminal del servidor.
 *
 *   npm run superusuario -- crear --email tu@correo --nombre "Tu Nombre"
 *   npm run superusuario -- promover --email alguien@correo
 *   npm run superusuario -- degradar --email alguien@correo
 *   npm run superusuario -- listar
 *
 * La web no puede crear administradores: las invitaciones de la interfaz solo
 * dan acceso de miembro. Para crear uno hay que tener acceso por SSH al VPS y
 * a la base de datos, que es la llave que se exige. Cada acción pide escribir
 * el correo otra vez para confirmar y queda registrada en superusuarios.log,
 * junto a la base.
 *
 * «crear» no pide contraseña aquí (no queda en el historial de la terminal):
 * imprime un enlace de invitación de 72 horas. La persona arma su perfil con
 * foto, elige su contraseña y activa la cuenta desde su correo, como todos.
 */

import crypto from "node:crypto";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function registrar(linea: string) {
  const db = (process.env.DATABASE_URL ?? "").replace(/^file:/, "");
  const carpeta = db ? path.dirname(path.resolve("prisma", db)) : process.cwd();
  const quien = process.env.SUDO_USER ?? process.env.USER ?? process.env.USERNAME ?? "?";
  try {
    appendFileSync(path.join(carpeta, "superusuarios.log"), `${new Date().toISOString()} [${quien}] ${linea}\n`);
  } catch {
    console.warn("No se pudo escribir el registro de auditoría.");
  }
}

async function confirmar(email: string) {
  if (!process.stdin.isTTY) throw new Error("Este comando es interactivo: córrelo en una terminal.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const r = await rl.question(`Para confirmar, escribe otra vez el correo (${email}): `);
  rl.close();
  if (r.trim().toLowerCase() !== email) throw new Error("No coincide. No se hizo nada.");
}

async function crear() {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const nombre = (arg("nombre") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Falta --email válido.");

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) throw new Error(`${email} ya tiene cuenta. Usa «promover» para darle rol de administrador.`);
  await confirmar(email);

  await prisma.invitacion.updateMany({ where: { email, aceptadaAt: null, revocadaAt: null }, data: { revocadaAt: new Date() } });
  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.invitacion.create({
    data: {
      email,
      nombre,
      role: "ADMIN",
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 72 * 3_600_000),
    },
  });
  const base = (arg("url") ?? process.env.APP_URL ?? "https://innovation.voltac.com.co").replace(/\/$/, "");
  registrar(`crear-admin ${email}`);
  console.log(`\nInvitación de ADMINISTRADOR para ${email} (vence en 72 horas, sirve una vez):\n\n  ${base}/invitacion/${token}\n`);
  console.log("Entrégala por un canal seguro. Después de crear su perfil, la persona activa la cuenta desde su correo.\n");
}

async function cambiarRol(rol: "ADMIN" | "MEMBER") {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error(`No hay cuenta con ${email}.`);
  if (rol === "MEMBER" && (await prisma.user.count({ where: { role: "ADMIN", active: true } })) <= 1 && u.role === "ADMIN") {
    throw new Error("Es el único administrador activo: crea o promueve otro antes de degradarlo.");
  }
  await confirmar(email);
  await prisma.user.update({ where: { id: u.id }, data: { role: rol } });
  // Con el rol cambiado, las sesiones abiertas se cierran para que tome efecto ya.
  await prisma.session.deleteMany({ where: { userId: u.id } });
  registrar(`${rol === "ADMIN" ? "promover" : "degradar"} ${email}`);
  console.log(`${u.name} (${email}) ahora es ${rol === "ADMIN" ? "administrador" : "miembro"}. Sus sesiones se cerraron.`);
}

async function listar() {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  for (const a of admins) console.log(`${a.active ? "activo  " : "inactivo"}  ${a.email}  ${a.name}${a.emailVerificadoAt ? "" : "  (sin activar)"}`);
  const pendientes = await prisma.invitacion.findMany({ where: { role: "ADMIN", aceptadaAt: null, revocadaAt: null } });
  for (const i of pendientes) console.log(`invitado  ${i.email}  vence ${i.expiresAt.toISOString()}`);
}

const comando = process.argv[2];
const acciones: Record<string, () => Promise<void>> = { crear, promover: () => cambiarRol("ADMIN"), degradar: () => cambiarRol("MEMBER"), listar };

(acciones[comando] ?? (async () => console.log("Uso: superusuario crear|promover|degradar|listar --email correo [--nombre \"Nombre\"]")))()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
