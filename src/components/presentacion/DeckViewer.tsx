"use client";

import { useRef, useState } from "react";

/**
 * El visor de la presentacion.
 *
 * El documento va dentro de un iframe y no inyectado en la pagina. No es una
 * precaucion de seguridad —el HTML lo cargo el propio equipo— sino de estilos:
 * la presentacion trae su tipografia, su paleta clara y sus medidas en
 * milimetros, y todo eso chocaria con el tema de la aplicacion. Aislado, se ve
 * exactamente como se va a imprimir.
 *
 * El boton de PDF llama a `print()` DENTRO del iframe. Imprimir desde la
 * pagina padre sacaria la aplicacion entera con la presentacion recortada en
 * medio; desde el iframe sale solo el documento, con el tamaño de pagina que
 * el propio HTML declara en su regla @page.
 */
export function DeckViewer({
  slug,
  titulo,
  subtitulo,
  laminas,
  tamano,
  generadaPorIA,
  actualizada,
  materia,
}: {
  slug: string;
  titulo: string;
  subtitulo: string;
  laminas: number;
  tamano: string;
  generadaPorIA: boolean;
  actualizada: string;
  materia: { fragmentos: number; insights: number; conceptos: number };
}) {
  const marco = useRef<HTMLIFrameElement>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  const ruta = `/proyectos/${slug}/presentacion/documento`;

  function imprimir() {
    const ventana = marco.current?.contentWindow;
    if (!ventana) {
      setAviso("La presentación aún no terminó de cargar.");
      return;
    }
    ventana.focus();
    ventana.print();
  }

  const fecha = new Date(actualizada).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      {/* ── Barra ──────────────────────────────────────────────────────── */}
      <div className="panel flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="min-w-[18ch] flex-1">
          <p className="text-[14.5px] font-semibold text-[#e8e3d8]">{titulo}</p>
          <p className="mt-0.5 text-[11.5px] text-[#8b9a97]">
            {subtitulo ? `${subtitulo} · ` : ""}
            {laminas} lámina{laminas === 1 ? "" : "s"}
            {tamano ? ` · ${tamano}` : ""} · actualizada el {fecha}
            {generadaPorIA ? " · generada por el agente" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={imprimir} className="btn btn-primary">
            Exportar a PDF
          </button>
          <a href={ruta} target="_blank" rel="noreferrer" className="btn">
            Abrir aparte
          </a>
          <button
            type="button"
            disabled
            title="El generador aún no está construido."
            className="btn cursor-not-allowed opacity-45"
          >
            Generar con el agente
          </button>
        </div>
      </div>

      {/* En el diálogo de impresión hay que activar los gráficos de fondo o
          las láminas salen en blanco: todo el color es fondo. Decirlo aquí
          ahorra el susto de ver el PDF vacío cinco minutos antes de exponer. */}
      <p className="text-[11.5px] leading-snug text-[#8b9a97]">
        Al exportar, activa <b className="font-semibold text-[#a9b5b3]">Gráficos de fondo</b> en el
        diálogo de impresión y deja los márgenes en <b className="font-semibold text-[#a9b5b3]">Ninguno</b>:
        todo el color de las láminas es fondo, y sin eso salen en blanco.
      </p>

      {aviso && <p className="text-[12px] text-[#c9a94e]">{aviso}</p>}

      {/* ── El documento ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[6px] border border-[rgba(232,227,216,0.14)] bg-[#0b1020]">
        {cargando && (
          <p className="absolute inset-x-0 top-1/2 text-center text-[12px] text-[#8b9a97]">
            Cargando la presentación…
          </p>
        )}
        <iframe
          ref={marco}
          src={ruta}
          title={titulo}
          onLoad={() => setCargando(false)}
          className="h-[76vh] min-h-[420px] w-full border-0"
        />
      </div>

      {/* ── Lo que falta ───────────────────────────────────────────────── */}
      <div className="panel max-w-[72ch]">
        <p className="kicker mb-2">Por qué el botón de generar está apagado</p>
        <p className="text-[12.5px] leading-relaxed text-[#a9b5b3]">
          Esta presentación se armó a mano. Todo lo que la sostiene ya vive en este proyecto:{" "}
          {materia.fragmentos} fragmentos en el mapa, {materia.insights} insight
          {materia.insights === 1 ? "" : "s"} y {materia.conceptos} concepto
          {materia.conceptos === 1 ? "" : "s"}. Cuando el generador exista, las láminas salen de
          ahí y no de un archivo aparte, que es lo que hoy hace que se desincronicen.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-[#8b9a97]">
          Mientras tanto se carga desde el servidor con{" "}
          <code className="font-mono text-[11.5px]">npm run presentacion:cargar</code>, y lo que se
          guarda es exactamente el documento que se expuso.
        </p>
      </div>
    </div>
  );
}
