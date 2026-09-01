/**
 * Gestion de tokens de API desde la linea de comandos.
 *
 *   npm run token:crear -- --email tu@correo --label "Claude Code"
 *   npm run token:listar
 *   npm run token:revocar -- --prefijo vin_AbCdEfGh
 *
 * Se hace por CLI y no por interfaz web a proposito: el token en claro se
 * muestra UNA sola vez y no debe quedar en el historial de un navegador ni en
 * una pantalla compartida.
 */

import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function crear() {
  const email = (arg("email") ?? process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase();
  const label = arg("label") ?? "Claude Code (MCP)";
  const readOnly = process.argv.includes("--solo-lectura");
  const dias = Number(arg("dias") ?? 0);

  if (!email) throw new Error("Falta --email");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No hay ningun usuario con el correo ${email}.`);

  const plain = "vin_" + crypto.randomBytes(32).toString("base64url");
  const prefix = plain.slice(0, 12);

  await prisma.apiToken.create({
    data: {
      tokenHash: crypto.createHash("sha256").update(plain).digest("hex"),
      prefix,
      label,
      userId: user.id,
      readOnly,
      expiresAt: dias > 0 ? new Date(Date.now() + dias * 86400_000) : null,
    },
  });

  console.log("");
  console.log("  Token creado para " + user.email + (readOnly ? "  (solo lectura)" : ""));
  console.log("  Etiqueta: " + label);
  console.log("");
  console.log("  " + plain);
  console.log("");
  console.log("  Guardalo ahora. No se puede volver a ver: la base solo tiene su hash.");
  console.log("");
}

async function listar() {
  const tokens = await prisma.apiToken.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });
  if (tokens.length === 0) return console.log("No hay tokens.");

  for (const t of tokens) {
    const estado = t.revokedAt
      ? "REVOCADO"
      : t.expiresAt && t.expiresAt < new Date()
        ? "VENCIDO"
        : "activo";
    console.log(
      [
        t.prefix.padEnd(14),
        estado.padEnd(9),
        t.readOnly ? "solo-lectura" : "escritura   ",
        t.user.email.padEnd(30),
        t.label,
        t.lastUsedAt ? `· usado ${t.lastUsedAt.toISOString().slice(0, 16)}` : "· sin usar",
      ].join(" "),
    );
  }
}

async function revocar() {
  const prefijo = arg("prefijo");
  if (!prefijo) throw new Error("Falta --prefijo (mira `npm run token:listar`)");

  const r = await prisma.apiToken.updateMany({
    where: { prefix: prefijo, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  console.log(r.count > 0 ? `Revocado ${prefijo}.` : `No habia token activo con ${prefijo}.`);
}

const accion = process.argv[2];
const acciones: Record<string, () => Promise<void>> = { crear, listar, revocar };

(acciones[accion] ?? (async () => console.log("Usa: crear | listar | revocar")))()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("\n  " + (e as Error).message + "\n");
    await prisma.$disconnect();
    process.exit(1);
  });
