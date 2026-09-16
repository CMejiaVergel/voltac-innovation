/**
 * Carga el documento de un artefacto.
 *
 *   npm run artefacto:cargar -- <id-del-artefacto> <archivo.html>
 *
 * El id aparece en la propia ficha del artefacto mientras no tiene documento.
 * Mismo camino que la presentacion: hoy el HTML se arma fuera y se carga aqui;
 * el dia que exista el generador, esta entrada no cambia.
 *
 * Avisa, sin bloquear, de las dos cosas que la leccion de Quantycs dejo:
 * botones que presentan el concepto como producto existente, y cifras en el
 * documento que no estan declaradas en la ficha.
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [id, archivo] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!id || !archivo) {
    console.error("Uso: npm run artefacto:cargar -- <id-del-artefacto> <archivo.html>");
    process.exit(1);
  }

  const artefacto = await prisma.artifact.findUnique({
    where: { id },
    select: {
      title: true,
      project: { select: { name: true } },
      cifras: { select: { value: true } },
    },
  });
  if (!artefacto) throw new Error(`No existe el artefacto "${id}".`);

  const html = readFileSync(archivo, "utf8");
  await prisma.artifact.update({ where: { id }, data: { html } });

  console.log(
    [
      `cargado: ${artefacto.title}`,
      `proyecto: ${artefacto.project.name}`,
      `peso: ${(Buffer.byteLength(html, "utf8") / 1024).toFixed(0)} KB`,
    ].join("\n"),
  );

  const texto = html.replace(/<[^>]+>/g, " ");
  const avisos: string[] = [];

  if (/\b(login|iniciar sesi[oó]n|entrar a la aplicaci[oó]n|ingresar)\b/i.test(texto)) {
    avisos.push("El documento tiene botones de ingreso o inicio de sesion: presenta el concepto como producto existente.");
  }

  const declaradas = new Set(artefacto.cifras.map((c) => c.value.replace(/\s/g, "")));
  const encontradas = [...new Set(texto.match(/[+-]?\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*%/g) ?? [])]
    .map((c) => c.replace(/\s/g, ""))
    .filter((c) => !declaradas.has(c));
  if (encontradas.length > 0) {
    avisos.push(
      `Porcentajes en el documento que no estan declarados como cifra en la ficha: ${encontradas.slice(0, 8).join(", ")}${encontradas.length > 8 ? "…" : ""}`,
    );
  }

  for (const a of avisos) console.log(`AVISO: ${a}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
