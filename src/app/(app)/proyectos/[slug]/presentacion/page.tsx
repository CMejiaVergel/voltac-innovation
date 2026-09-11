import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireProject } from "@/lib/projects";
import { DeckViewer } from "@/components/presentacion/DeckViewer";

/**
 * La presentacion del proyecto.
 *
 * Es la quinta cara del trabajo, junto al brief, el mapa, los insights y los
 * conceptos: el documento con el que el equipo devuelve lo que encontro a la
 * empresa que planteo el reto, y con el que recoge su retroalimentacion.
 * Vivia en una carpeta del escritorio y se desincronizaba el mismo dia — se
 * corregia un insight en la plataforma y la lamina seguia diciendo lo
 * anterior. Aqui queda junto al proyecto del que salio.
 *
 * HOY SOLO SE VE. El boton de generar esta desactivado a proposito y lo dice:
 * el banco de conocimiento completo ya esta en la herramienta, asi que armar
 * estas laminas solo es cuestion de escribir el generador. Dejar el boton
 * apagado es mas honesto que esconder la pieza que falta.
 */
export default async function PresentacionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireUser();
  const { project } = await requireProject(user, slug);

  // El HTML pesa megabytes: aqui solo se piden los metadatos. El documento lo
  // trae el iframe por su propia ruta, y asi no viaja dentro del arbol de
  // React ni se serializa en el payload de la pagina.
  const deck = await prisma.deck.findFirst({
    where: { projectId: project.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      subtitle: true,
      pages: true,
      pageSize: true,
      source: true,
      updatedAt: true,
    },
  });

  const [insights, conceptos, fragmentos] = await Promise.all([
    prisma.insight.count({
      where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
    }),
    prisma.concept.count({ where: { projectId: project.id, hidden: false } }),
    prisma.fragment.count({ where: { map: { projectId: project.id }, hidden: false } }),
  ]);

  return (
    <div className="mt-7">
      <div className="mb-6 max-w-[70ch]">
        <p className="kicker mb-2">Presentación</p>
        <p className="hint">
          El documento con el que se devuelve el trabajo a la empresa y se recoge su
          retroalimentación. Se guarda junto al proyecto para que la versión que se expuso quede
          fechada, y no en una carpeta donde se desincroniza del mapa a los dos días.
        </p>
      </div>

      {deck ? (
        <DeckViewer
          slug={slug}
          titulo={deck.title}
          subtitulo={deck.subtitle}
          laminas={deck.pages}
          tamano={deck.pageSize}
          generadaPorIA={deck.source === "AGENT"}
          actualizada={deck.updatedAt.toISOString()}
          materia={{ fragmentos, insights, conceptos }}
        />
      ) : (
        <div className="panel max-w-[68ch]">
          <p className="text-[13.5px] leading-relaxed text-[#a9b5b3]">
            Este proyecto todavía no tiene presentación cargada.
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-[#8b9a97]">
            Hoy se carga con <code className="font-mono text-[11.5px]">npm run presentacion:cargar</code>{" "}
            desde el servidor. El generador automático es lo que falta: la materia prima —
            {fragmentos} fragmentos, {insights} insight{insights === 1 ? "" : "s"} y {conceptos}{" "}
            concepto{conceptos === 1 ? "" : "s"}— ya está en{" "}
            <Link href={`/proyectos/${slug}/combinar`} className="text-accent underline">
              este mismo proyecto
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
