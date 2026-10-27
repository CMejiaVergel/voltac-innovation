import Link from "next/link";
import type { ReactNode } from "react";

import { LINEA_CONCEPTO, SOLUTION_FOCI } from "@/lib/gimi";
import { VERIFICATION_META, VERIFICATIONS } from "@/lib/enums";
import { PPTX_ACTIVO } from "@/lib/v2";

/**
 * Guía de uso de la v2. Organizada como el propio proceso: cada etapa con qué
 * se hace, cómo y cuándo se da por hecha, para que la persona la consulte en
 * el momento en que la necesita y no tenga que leerla de corrido.
 */

const ETAPAS = [
  { id: "configurar", n: 1, nombre: "Configurar", idea: "La organización y su reto" },
  { id: "divergir", n: 2, nombre: "Divergir", idea: "El mapa de post-its" },
  { id: "plataformas", n: 3, nombre: "Plataformas", idea: "Dónde crecer" },
  { id: "combinar", n: 4, nombre: "Combinar", idea: "Armar conceptos" },
  { id: "convergir", n: 5, nombre: "Convergir", idea: "Priorizar" },
  { id: "actuar", n: 6, nombre: "Actuar", idea: "La línea recta" },
];

export function GuiaV2() {
  return (
    <article className="mx-auto max-w-[860px] pt-7 pb-16">
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#e8e3d8]">Guía de uso</h1>
      <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed text-[#a9b5b3]">
        La plataforma lleva al equipo del reto al concepto que sigue adelante. Es un embudo: muchas ideas al
        principio, pocas al final. Desde la priorización, cada concepto elegido recorre la misma línea recta de
        pasos.
      </p>

      {/* El recorrido en una mirada */}
      <nav className="mt-6 grid gap-2 sm:grid-cols-5" aria-label="Etapas">
        {ETAPAS.map((e) => (
          <a
            key={e.id}
            href={`#${e.id}`}
            className="rounded-[4px] border border-[rgba(232,227,216,0.12)] bg-panel px-3 py-3 transition hover:border-accent"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-accent text-[12px] font-semibold text-accent">{e.n}</span>
            <span className="mt-2 block text-[14px] font-semibold text-[#e8e3d8]">{e.nombre}</span>
            <span className="block text-[11.5px] text-[#7f8f8c]">{e.idea}</span>
          </a>
        ))}
      </nav>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#8b9a97]">
        <a href="#ia" className="hover:text-accent">Dónde ayuda la IA</a>
        {PPTX_ACTIVO && <a href="#pptx" className="hover:text-accent">Descargar en PowerPoint</a>}
        <a href="#claude" className="hover:text-accent">Trabajar con Claude</a>
        <a href="#roles" className="hover:text-accent">Roles y celular</a>
      </p>

      <Etapa id="configurar" n={1} nombre="Configurar" donde={<Link href="/organizaciones">Organizaciones</Link>}>
        <p>
          Todo empieza en la organización donde se quiere innovar, no en el reto. Es el Paso 1 del proceso del GIMI
          (IMBOK): definir las razones y los límites de la innovación. Con eso se aceptan o descartan retos y conceptos.
        </p>
        <Pasos
          items={[
            ["Intención de innovar", "Qué significa innovar para la organización; la razón de cambio («Necesitamos innovar porque…»); la brecha de crecimiento (cuánto y para cuándo); y el perfil de inversión: posicionamiento (imitador, transformador o pionero), siete ejes de táctico a estratégico y los límites. Se resume sola en tres frases."],
            ["Proponer desafíos", "Cada persona trae un problema que le emociona resolver y responde tres preguntas sobre él. En «¿Encaja con la organización?» se contrasta con la intención."],
            ["Votar", "Cada persona vota por un desafío, y cada voto se ve con el color de quien votó. El responsable selecciona el ganador. Si el reto lo entregó la organización o el sponsor, se pega tal cual y se salta la votación."],
            ["Diseñar el reto", `El problema, por qué motiva, a qué se refieren las soluciones (${SOLUTION_FOCI.length} opciones) y la meta con cifra y fecha. Al crearlo nace el proyecto.`],
          ]}
        />
        <Hecho>Cuando el reto tiene problema y meta.</Hecho>
      </Etapa>

      <Etapa id="divergir" n={2} nombre="Divergir" donde="pestaña Divergir (Mapa en el celular)">
        <p>
          El Mapa de Oportunidades es un pliego de post-its: cinco dimensiones del negocio (filas) por cinco lentes
          para mirarlas (columnas). Su propósito no es generar ideas sino encontrar insights: anote todo lo que vea,
          incluso lo que parezca descabellado, y conecte lo que descubra.
        </p>
        <ul className="lista">
          <li>Toque <b>+</b> en una celda para pegar un post-it. El título va corto (2 a 5 palabras); el detalle completo, debajo.</li>
          <li>Toque un post-it para leerlo entero, corregirlo, cambiarlo de celda, ocultarlo o borrarlo.</li>
          <li>En computador, arrástrelo a otra celda. En el celular, elija la lente arriba y muévalo desde su detalle.</li>
          <li>Las celdas punteadas están vacías: ahí falta mirar.</li>
          <li>Toque el nombre de una lente (arriba) para ver su ejercicio: competidores usuales e inusuales, nuevos aliados, los zapatos de otros…</li>
          <li>La franja de color a la izquierda de cada post-it es la de quien lo puso.</li>
          <li>
            <b>+ Conectar post-its</b>: toque los post-its que se conectan y escriba lo que descubrió, del dato al «¿y qué?»
            y al insight. El insight queda dibujado sobre sus post-its con su número; toque su nombre para resaltarlos.
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {VERIFICATIONS.map((v) => (
            <span key={v} className="flex items-center gap-2 text-[12.5px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: VERIFICATION_META[v].color }} />
              <b className="text-[#e8e3d8]">{VERIFICATION_META[v].label}</b>
              <span className="text-[#8b9a97]">— {VERIFICATION_META[v].help}</span>
            </span>
          ))}
        </div>
        <ul className="lista">
          <li>Al abrir una lente aparece su hoja de trabajo: las tendencias con su impacto e incertidumbre y los escenarios (Futuro), los competidores usuales e inusuales, los aliados posibles o los actores de la cadena. Desde cada renglón, <b>+ idea al mapa</b> pega un post-it en esa lente.</li>
          <li><b>Organizado</b> (arriba del mapa): cada dimensión con los post-its de todas las lentes. Arrastre los parecidos a un mismo grupo y póngale una etiqueta; oculte los duplicados. En el celular, el grupo se elige desde el post-it.</li>
          <li>Marque con <b>★ Punto de interés</b> los post-its de los que puede arrancar una plataforma de crecimiento.</li>
        </ul>
        <Hecho>Cuando el mapa está organizado en grupos y el equipo pasa a Plataformas.</Hecho>
      </Etapa>

      <Etapa id="plataformas" n={3} nombre="Plataformas de crecimiento" donde="pestaña Plataformas">
        <p>
          Una plataforma de crecimiento es un espacio donde la empresa quiere innovar: lo bastante amplio para varios conceptos y lo bastante concreto para
          imaginarlo. Se trabaja en tres ejercicios cortos.
        </p>
        <ul className="lista">
          <li><b>Identificar:</b> cree una plataforma, toque en el mapa organizado los fragmentos que la sostienen, escriba su historia y marque las cinco que más resuenan.</li>
          <li><b>Priorizar:</b> el equipo define sus criterios, califica cada plataforma de 1 a 5 y prioriza una.</li>
          <li><b>Desarrollar:</b> la priorizada se explica en cinco bloques: insights que la impulsan, segmentos, activos y aliados, propuesta de valor y por qué puede ganar.</li>
        </ul>
        <Hecho>Cuando hay una plataforma priorizada y desarrollada: los conceptos se arman dentro de ella.</Hecho>
      </Etapa>

      <Etapa id="combinar" n={4} nombre="Combinar" donde="pestaña Combinar (Conceptos en el celular)">
        <p>
          El lienzo de concepto es donde los post-its se vuelven negocio, en torno a la plataforma priorizada. Cada concepto
          tiene una casilla por dimensión: a quiénes nos dirigimos, dónde y cuándo lo ofrecemos, qué ofrecemos, qué capacidades
          requerimos y qué modelo de negocio, precios y aliados necesitamos.
        </p>
        <ul className="lista">
          <li>Arrastre post-its desde el mapa de la izquierda, tóquelos, o use el <b>+</b> de cada casilla.</li>
          <li>La <b>×</b> devuelve el post-it al mapa. Un post-it puede estar en varios conceptos: se enlaza, no se mueve.</li>
          <li>En el mapa de la izquierda, <b>★ Plataforma</b> deja solo los fragmentos de la plataforma; los puntos de interés salen primero.</li>
          <li>El concepto dice si es incremental, disruptivo o radical según cuántos de sus puntos son del negocio actual (lente Su Compañía). «Hacerlo robusto» abre las preguntas de cada casilla.</li>
          <li>Debajo se ven los insights que lo respaldan: los que comparten post-its con el concepto.</li>
          <li><b>Mapa de conexión de puntos</b> (debajo del concepto): el mapa completo con cada post-it como un punto y el concepto como el trazo que atraviesa las dimensiones. Dice qué dimensión le falta; tocar un punto lo suma o lo suelta, y «Ver los demás conceptos» los compara.</li>
          <li>Varios conceptos a la vez, cada uno en su pestaña. Al final, la propuesta de valor y la frase: «Ofreceremos … a …, que necesita …, entregado a través de …, producido por …, y generamos dinero mediante …».</li>
        </ul>
        <Hecho>Cuando los conceptos empiezan a evaluarse en Convergir.</Hecho>
      </Etapa>

      <Etapa id="convergir" n={5} nombre="Convergir" donde="pestaña Convergir (Priorizar en el celular)">
        <p>
          La matriz ubica cada concepto según dos preguntas: <b>Atractividad</b> (¿vale la pena?: mercado, opciones
          que abre, recompensa frente a riesgo) y <b>Fit</b> (¿es para nosotros?: viabilidad, estrategia, pasión). Cada
          criterio se puntúa de 1 a 5; al puntuar el Fit se ve la intención de innovar de la organización.
        </p>
        <p className="mt-2">
          La matriz orienta, no decide. El equipo marca <b>«★ Este sigue adelante»</b> en el concepto o conceptos que
          continúan.
        </p>
        <Hecho>Cuando al menos un concepto sigue adelante.</Hecho>
      </Etapa>

      <Etapa id="actuar" n={6} nombre="Actuar" donde="pestaña Actuar">
        <p>Cada concepto que sigue adelante recorre los mismos cinco pasos, uno por pantalla:</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-5">
          {LINEA_CONCEPTO.map((p, i) => (
            <li key={p.key} className="rounded-[4px] border border-[rgba(232,227,216,0.1)] px-3 py-2">
              <span className="text-[11px] text-accent">{i + 1}</span>
              <span className="block text-[13px] font-semibold text-[#e8e3d8]">{p.nombre}</span>
            </li>
          ))}
        </ol>
        <ul className="lista mt-3">
          <li><b>Brochure:</b> titular, problema, solución, beneficios y llamado a la acción, con vista previa. Listo con titular y solución.</li>
          <li><b>Artefacto:</b> lo que se le muestra a la empresa (protocepto, mockup, prototipo, orden de compra…). Cada vuelta con el mercado suma una iteración. Listo cuando uno está «Listo para presentar» o «Presentado».</li>
          <li><b>Ingeniería inversa:</b> lo que tendría que ser cierto. Se marcan con ★ las tres menos probables y cada una lleva su prueba rápida. Listo cuando una crítica tiene prueba.</li>
          <li><b>Propuesta de valor:</b> los beneficios del concepto y quién los obtiene: clientes, canales, proveedores y aliados. Listo al escribirla.</li>
          <li><b>Caso de negocio:</b> la estructura del Taller 4, un bloque por pantalla: resumen ejecutivo, el concepto real (con su «¡ajá!»), stakeholders y el gana-gana-gana, modelo de negocio y tamaño de la oportunidad (con los indicadores en pesos), riesgos y opciones, plan de acción (qué, cómo, quién, cuándo) y el discurso. Listo con el resumen, tres bloques y un paso en el plan.</li>
        </ul>
      </Etapa>

      <Seccion id="ia" titulo="Dónde ayuda la IA">
        <p>
          Las personas hacen el proceso; la IA solo asiste en tres puntos, y siempre deja el resultado para que el
          equipo lo revise:
        </p>
        <ul className="lista">
          <li><b>✦ Sugerir títulos</b> (Divergir): propone títulos cortos para los post-its que no tienen. No toca el texto.</li>
          <li><b>✦ Redactar con IA</b> (Combinar): propone nombre y frase del concepto a partir de sus post-its. No guarda nada hasta que el equipo lo decide.</li>
          <li><b>Trabajar con Claude</b>: ver abajo.</li>
        </ul>
        <p className="mt-2">
          Los botones ✦ usan la clave de OpenRouter de cada persona: se configura en <Link href="/cuenta" className="text-accent underline">Cuenta</Link>.
        </p>
      </Seccion>

      {PPTX_ACTIVO && (
        <Seccion id="pptx" titulo="Descargar en PowerPoint">
          <ul className="lista">
            <li><b>Vista general → «Descargar presentación (PPTX)»:</b> portada, reto, embudo, mapa, matriz y la línea de cada concepto que sigue adelante.</li>
            <li><b>Actuar → «Descargar PPTX»:</b> solo la línea de ese concepto, para una reunión puntual.</li>
          </ul>
          <p className="mt-2">El archivo es editable: texto y formas de PowerPoint, no imágenes.</p>
        </Seccion>
      )}

      <Seccion id="claude" titulo="Trabajar con Claude (canal no-code)">
        <p>
          Con el conector de la plataforma, Claude puede hacer cambios por usted mientras conversan: «pega en el mapa
          estos hallazgos de la reunión», «pon títulos a los post-its sin título», «arma un concepto con estos
          post-its», «escribe el brochure del concepto A con lo que hablamos». Trabaja con sus permisos y cada cambio
          queda en el historial como «vía Claude».
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Caja titulo="Lo que Claude puede hacer">
            <ul className="lista">
              <li>Crear organizaciones y escribir su intención de innovar</li>
              <li>Proponer desafíos</li>
              <li>Leer el embudo y el mapa</li>
              <li>Pegar, titular, corregir y mover post-its</li>
              <li>Armar y ajustar conceptos</li>
              <li>Escribir brochure, propuesta de valor y caso de negocio</li>
              <li>Agregar artefactos y supuestos</li>
            </ul>
          </Caja>
          <Caja titulo="Lo que decide el equipo, en la plataforma">
            <ul className="lista">
              <li>Votar y seleccionar el desafío</li>
              <li>Puntuar los conceptos en la matriz</li>
              <li>Decidir qué concepto sigue adelante</li>
              <li>Marcar las tres suposiciones menos probables</li>
              <li>Mover el estado de los artefactos</li>
            </ul>
          </Caja>
        </div>
        <h3 className="mt-5 text-[14px] font-semibold text-[#e8e3d8]">Cómo conectarlo</h3>
        <ol className="lista mt-2">
          <li>Pida al administrador un <b>token personal</b>. Es como una contraseña: no lo comparta.</li>
          <li>En Claude Code o Claude Desktop, agregue el servidor «voltac-innovacion» con esta configuración:</li>
        </ol>
        <pre className="mt-2 overflow-x-auto rounded-[4px] border border-[rgba(232,227,216,0.12)] bg-[#0e1417] p-3 text-[11.5px] leading-relaxed text-[#c0ccca]">{`{
  "mcpServers": {
    "voltac-innovacion": {
      "command": "node",
      "args": ["<carpeta de la plataforma>/mcp/server.mjs"],
      "env": {
        "VOLTAC_API_URL": "https://innovation.voltac.com.co",
        "VOLTAC_API_TOKEN": "<su token>"
      }
    }
  }
}`}</pre>
        <p className="mt-2">
          Para empezar, pídale a Claude «muéstrame el embudo del proyecto …». Si algo no le corresponde (por ejemplo,
          votar), Claude le dirá que eso se hace en la plataforma.
        </p>
      </Seccion>

      <Seccion id="roles" titulo="Roles y celular">
        <ul className="lista">
          <li><b>Responsable:</b> edita todo, gestiona el equipo y selecciona el desafío.</li>
          <li><b>Editor:</b> propone, vota, pega post-its y arma conceptos.</li>
          <li><b>Lector:</b> ve todo sin cambiar nada.</li>
          <li>En el celular, la navegación está en la barra inferior. El mapa se ve una lente a la vez y los post-its se abren como hoja desde abajo.</li>
        </ul>
      </Seccion>
    </article>
  );
}

function Etapa({ id, n, nombre, donde, children }: { id: string; n: number; nombre: string; donde: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20 border-t border-[rgba(232,227,216,0.1)] pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[13px] font-bold text-accentDeep">{n}</span>
        <h2 className="text-[20px] font-bold text-[#e8e3d8]">{nombre}</h2>
        <span className="text-[12px] text-[#7f8f8c]">· {donde}</span>
      </div>
      <div className="guia-cuerpo mt-3 text-[13.5px] leading-relaxed text-[#a9b5b3]">{children}</div>
    </section>
  );
}

function Seccion({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20 border-t border-[rgba(232,227,216,0.1)] pt-6">
      <h2 className="text-[20px] font-bold text-[#e8e3d8]">{titulo}</h2>
      <div className="guia-cuerpo mt-3 text-[13.5px] leading-relaxed text-[#a9b5b3]">{children}</div>
    </section>
  );
}

function Pasos({ items }: { items: [string, string][] }) {
  return (
    <ol className="mt-3 flex flex-col gap-2">
      {items.map(([t, d], i) => (
        <li key={t} className="flex gap-3 rounded-[4px] border border-[rgba(232,227,216,0.1)] px-3 py-2.5">
          <span className="font-mono text-[12px] text-accent">{i + 1}</span>
          <span>
            <b className="text-[#e8e3d8]">{t}.</b> {d}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Hecho({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-center gap-2 text-[12.5px] text-accent">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] text-accentDeep">✓</span>
      {children}
    </p>
  );
}

function Caja({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-[4px] border border-[rgba(232,227,216,0.12)] bg-panel p-4">
      <h3 className="mb-2 text-[13.5px] font-semibold text-[#e8e3d8]">{titulo}</h3>
      {children}
    </div>
  );
}
