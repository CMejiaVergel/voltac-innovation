/**
 * Mete una presentacion ya armada dentro de su proyecto.
 *
 *   npm run presentacion:cargar -- <slug> <archivo.html> [--titulo "..."] [--subtitulo "..."]
 *
 * Existe porque el generador todavia no existe. El dia que exista, esta ruta
 * de entrada se queda igual: lo unico que cambia es quien escribe el HTML.
 *
 * Al guardar se quita la barra de herramientas que el documento trae para
 * abrirse suelto en un navegador. Dentro de la plataforma esa barra sobra —la
 * pantalla ya pone la suya— y ademas confundia: dos botones de exportar, uno
 * encima del otro, haciendo lo mismo.
 */
import { readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** Cuenta las laminas por el marcado del propio documento. */
function contarLaminas(html: string): number {
  return (html.match(/<section[^>]*class="[^"]*\bslide\b/g) ?? []).length;
}

/** El tamaño de pagina que el documento declara, para mostrarlo antes de imprimir. */
function tamanoPagina(html: string): string {
  const m = html.match(/@page\s*\{[^}]*size\s*:\s*([^;}]+)/i);
  return m ? m[1].trim() : "";
}

/** La barra del documento suelto: dentro de la plataforma la pone la pantalla. */
function quitarBarra(html: string): string {
  const i = html.indexOf('<div class="toolbar">');
  if (i < 0) return html;
  const fin = html.indexOf("</div>", i);
  if (fin < 0) return html;
  return html.slice(0, i) + html.slice(fin + "</div>".length);
}

async function main() {
  const [slug, archivo] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!slug || !archivo) {
    console.error(
      'Uso: npm run presentacion:cargar -- <slug> <archivo.html> [--titulo "..."] [--subtitulo "..."]',
    );
    process.exit(1);
  }

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!project) throw new Error(`No existe el proyecto "${slug}".`);

  const crudo = readFileSync(archivo, "utf8");
  const html = quitarBarra(crudo);
  const pages = contarLaminas(html);
  const pageSize = tamanoPagina(html);

  const titulo =
    arg("titulo") ?? (crudo.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || project.name);
  const subtitulo = arg("subtitulo") ?? "";

  // Una presentacion por proyecto mientras no haya versiones: cargar de nuevo
  // reemplaza la anterior en vez de acumular copias que nadie distingue.
  const previa = await prisma.deck.findFirst({
    where: { projectId: project.id },
    select: { id: true },
  });

  const datos = { title: titulo, subtitle: subtitulo, html, pages, pageSize, source: "HUMAN" };
  const deck = previa
    ? await prisma.deck.update({ where: { id: previa.id }, data: datos })
    : await prisma.deck.create({ data: { projectId: project.id, ...datos } });

  console.log(
    [
      `${previa ? "actualizada" : "creada"}: ${deck.title}`,
      `proyecto: ${project.name}`,
      `laminas: ${pages}`,
      `pagina: ${pageSize || "sin declarar"}`,
      `peso: ${(Buffer.byteLength(html, "utf8") / 1024 / 1024).toFixed(1)} MB`,
    ].join("\n"),
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
