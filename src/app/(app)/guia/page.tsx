import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { IDEX, HATS, THIN_CELL_THRESHOLD } from "@/lib/gimi";
import { VERIFICATION_META, type Verification } from "@/lib/enums";

export const metadata = { title: "Guia de uso — Voltac Innovacion" };

/**
 * La guia.
 *
 * Vive dentro de la aplicacion y no en un documento aparte porque una guia que
 * hay que ir a buscar no se lee. Explica no solo QUE hace cada pantalla, sino
 * POR QUE esta donde esta: casi todas las decisiones de esta herramienta salen
 * de una regla del metodo GIMI, y sin esa regla las pantallas parecen
 * arbitrarias.
 */
export default async function GuiaPage() {
  await requireUser();

  return (
    <article className="mx-auto max-w-[70ch] pt-7 pb-10">
      <p className="kicker mb-2">Guia de uso</p>
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#e8e3d8]">
        Como funciona esta herramienta
      </h1>
      <p className="mt-4 text-[14px] leading-relaxed text-[#a9b5b3]">
        Todo el software esta construido sobre el proceso <b className="text-[#e8e3d8]">IDEX</b>{" "}
        del GIM Institute. Si algo parece raro o parece que sobra, casi siempre es porque
        responde a una regla del metodo, no a una preferencia de diseño. Esta guia explica
        cada pantalla y la regla detras.
      </p>

      {/* ── El proceso ────────────────────────────────────────────────────── */}
      <Section title="El proceso completo, y donde estamos">
        <p>
          IDEX tiene cinco etapas. Cada una tiene sus{" "}
          <b className="text-[#cbd4d2]">sombreros de pensamiento</b>: la actitud mental con la
          que hay que entrar. Sirven para no mezclar. Cuando alguien critica una idea en plena
          etapa de Divergir, esta usando el sombrero negro donde tocaba el verde, y mata ideas
          que ni siquiera se habian terminado de decir.
        </p>
        <ol className="my-5 flex flex-col gap-3">
          {IDEX.map((s) => (
            <li
              key={s.key}
              className="border-l-2 pl-3"
              style={{ borderColor: s.implemented ? "#6FBFB2" : "rgba(232,227,216,0.16)" }}
            >
              <span className="flex flex-wrap items-baseline gap-2">
                <b className="text-[14px] text-[#e8e3d8]">
                  {s.n}. {s.name}
                </b>
                <span className="text-[12.5px] text-[#8b9a97]">{s.purpose}</span>
                {!s.implemented && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-[#4d5a58]">
                    aun no construido
                  </span>
                )}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                {s.hats.map((h) => (
                  <span key={h} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full border border-black/30"
                      style={{ background: HATS[h].color }}
                    />
                    <span className="text-[11px] text-[#7f8f8c]">{HATS[h].trait}</span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
        <p>
          Hoy estan construidas las dos primeras. Las otras tres se apoyan sobre lo que salga
          del mapa, asi que no tiene sentido construirlas antes de que el mapa este lleno.
        </p>
      </Section>

      {/* ── Proyectos ─────────────────────────────────────────────────────── */}
      <Section title="Proyectos">
        <p>
          Un proyecto es <b className="text-[#cbd4d2]">un reto de una empresa</b>. Cabot es
          uno. Si mañana entra otro reto, es otro proyecto, con su mapa y su equipo aparte.
        </p>
        <p>
          Cada proyecto es privado: solo lo ven sus miembros. Alguien que no este invitado no
          es que vea el proyecto vacio — es que la aplicacion le responde que no existe.
        </p>
      </Section>

      {/* ── Configurar ────────────────────────────────────────────────────── */}
      <Section title="Configurar — la pestaña del reto">
        <p>
          Es la etapa 1 de IDEX. Aqui se escribe <b className="text-[#cbd4d2]">a que estamos
          jugando</b> antes de empezar a buscar. Tiene cuatro bloques.
        </p>

        <Def term="El reto">
          El texto que entrego la empresa, <b className="text-[#cbd4d2]">literal</b>. No lo
          parafrasees: el agente lo cita tal cual, y una parafrasis tuya se convierte en una
          instruccion que la empresa nunca dio. Debajo va tu lectura del problema, por que
          importa y cual es la meta con cifra y fecha.
        </Def>

        <Def term="Alcance del desafio">
          Las casillas de &ldquo;a que se refieren las soluciones&rdquo; salen tal cual de la
          plantilla oficial GIMI. Marcan el terreno: si marcas{" "}
          <i>identificar nuevos modelos de negocio</i>, le estas diciendo al equipo y al
          agente que una solucion puramente tecnica se queda corta.
          <br />
          <br />
          <b className="text-[#cbd4d2]">Que hacer</b> y{" "}
          <b className="text-[#cbd4d2]">que evitar</b> son las listas que dio la empresa. La
          segunda es la mas util de las dos: el agente tiene prohibido proponer fragmentos que
          empujen hacia ahi. Es lo que evita perder dias en un camino que la empresa ya
          descarto.
        </Def>

        <Def term="Intencion de innovar">
          Marco GIMI. La <b className="text-[#cbd4d2]">razon de cambio</b> dice quien esta
          empujando (el mercado, la competencia, un cliente). El{" "}
          <b className="text-[#cbd4d2]">perfil de inversion</b> dice cuanto puede alejarse la
          solucion del negocio actual. Si el perfil es &ldquo;lejos del nucleo&rdquo;, proponer
          una mejora incremental es no haber entendido el encargo.
        </Def>

        <Def term="Guia de busqueda para el agente">
          Terminos, normas, regiones y nombres propios que el agente debe priorizar, y lo que
          debe ignorar. Es el bloque que mas cambia la calidad de lo que devuelve. Sin
          &ldquo;corredor de Mamonal&rdquo; o &ldquo;Resolucion 1256&rdquo;, el agente busca
          generalidades sobre reuso de agua y trae poco util.
        </Def>
      </Section>

      {/* ── El mapa ───────────────────────────────────────────────────────── */}
      <Section title="Mapa de Oportunidades — la pestaña central">
        <p>
          Es la etapa 2, Divergir. La version digital del papelografo con post-its del taller.
          Cinco <b className="text-[#cbd4d2]">dimensiones del negocio</b> (las filas de color)
          cruzadas con cinco <b className="text-[#cbd4d2]">lentes de observacion</b> (las
          columnas). Veinticinco celdas.
        </p>

        <Def term="Que es un fragmento">
          Un papelito con <b className="text-[#cbd4d2]">una sola observacion cruda</b>. Se
          anota aunque no encaje con nada y aunque no sepas todavia para que sirve. Esa es la
          idea: si solo anotas lo que ya te encaja, el mapa termina confirmando lo que ya
          pensabas.
        </Def>

        <Def term="Por que no se escriben conclusiones aqui">
          Esta es <b className="text-[#cbd4d2]">la regla mas importante de la herramienta</b>.
          La agenda oficial del taller pone &ldquo;Manos a la obra: BOM&rdquo; primero y
          &ldquo;Que es un insight&rdquo; despues, y el orden no es casual. Los insights se
          leen <i>al final</i>, cruzando celdas sobre el mapa ya lleno. Si escribes la
          conclusion dentro del mapa, dejas de descubrirla: solo la confirmas.
          <br />
          <br />
          Por eso la aplicacion no tiene ningun campo para insights dentro del mapa, ni deja
          etiquetar fragmentos con el insight al que pertenecen. No es un olvido.
        </Def>

        <Def term="Adyacencias, la columna que mas se hace mal">
          Se registra el <b className="text-[#cbd4d2]">mecanismo trasladable</b>, no el nombre
          de la empresa. &ldquo;Coca-Cola&rdquo; no sirve para nada. &ldquo;Devuelve a la
          cuenca el agua que consume mediante programas de reposicion&rdquo; si, porque eso se
          puede intentar en Mamonal. La pregunta no es <i>quien lo hizo</i> sino{" "}
          <i>que hizo que podamos copiar</i>.
        </Def>

        <Def term="Los tres estados de verificacion">
          Cada fragmento lleva una marca. Se cambia pulsandola. Es lo que impide que una
          estimacion se lea, tres semanas despues, como si fuera un hecho:
          <ul className="mt-3 flex flex-col gap-2">
            {(["VERIFIED", "TO_CONFIRM", "ASSUMPTION"] as Verification[]).map((v) => (
              <li key={v} className="flex gap-2">
                <span style={{ color: VERIFICATION_META[v].color }} className="shrink-0">
                  {VERIFICATION_META[v].dot} {VERIFICATION_META[v].short}
                </span>
                <span>
                  <b className="text-[#cbd4d2]">{VERIFICATION_META[v].label}.</b>{" "}
                  {VERIFICATION_META[v].help}
                </span>
              </li>
            ))}
          </ul>
        </Def>

        <Def term="El boton Vacios y las celdas rayadas">
          Raya las celdas con menos de {THIN_CELL_THRESHOLD} fragmentos. No es decoracion: una
          celda casi vacia normalmente significa que{" "}
          <b className="text-[#cbd4d2]">nadie miro el reto desde ese lente</b>, no que ahi no
          haya nada. Es el detector de puntos ciegos del equipo, y es de donde sale el trabajo
          que le vas a encargar al agente.
        </Def>

        <Def term="Mover, editar, borrar">
          En computador se arrastra el papelito de una celda a otra. En telefono no hay
          arrastre — pelea con el desplazamiento — asi que cada papelito tiene un menu{" "}
          <span className="font-mono">⋯</span> con &ldquo;mover a&rdquo;. El texto se edita
          pulsando encima. Todo cambio queda registrado con quien lo hizo y cuando; incluso si
          borras un fragmento, su historial sobrevive.
        </Def>

        <Def term="En el telefono se navega por lente">
          Una rejilla de 25 celdas no cabe en un movil. En pantalla pequeña eliges arriba un
          lente y ves las cinco dimensiones apiladas. Es como se recorre en el taller:
          &ldquo;ahora miremos todo desde Adyacencias&rdquo;.
        </Def>
      </Section>

      {/* ── Agente ────────────────────────────────────────────────────────── */}
      <Section title="Agente investigador">
        <p>
          Es un asistente que busca en internet y{" "}
          <b className="text-[#cbd4d2]">propone</b> fragmentos. No los mete en el mapa. Existe
          porque llenar 25 celdas a mano son semanas de trabajo, y buena parte es busqueda
          mecanica que una maquina hace mas rapido. Lo que la maquina no puede hacer es
          decidir si algo sirve — eso sigue siendo tuyo.
        </p>

        <Def term="Motor de IA">
          Elige que modelo de inteligencia artificial trabaja. La lista viene de OpenRouter con
          los precios en vivo, y el buscador filtra entre cientos. Arriba salen los
          recomendados para esta tarea concreta.
          <br />
          <br />
          El interruptor de <b className="text-[#cbd4d2]">busqueda web</b> es el que decide el
          costo real: se paga por cada resultado consultado, aparte del texto. Apagado, el
          agente solo usa lo que ya sabe y casi todo saldra marcado como supuesto.
        </Def>

        <Def term="Lanzar una investigacion — la tabla de casillas">
          Esa tabla <b className="text-[#cbd4d2]">es el mapa visto desde arriba</b>: las filas
          son las dimensiones, las columnas son los lentes, y cada casilla es una celda del
          mapa. El numero al lado de cada casilla es cuantos fragmentos hay hoy ahi; en ambar,
          las que tienen menos de {THIN_CELL_THRESHOLD}.
          <br />
          <br />
          <b className="text-[#cbd4d2]">Marcas las celdas donde quieres que trabaje.</b> Al
          entrar vienen premarcadas las flacas, que es donde el agente aporta de verdad. Los
          atajos <i>todas</i>, <i>solo las vacias</i> y <i>ninguna</i> estan arriba a la
          derecha.
          <br />
          <br />
          Es asi y no un boton de &ldquo;llenar todo&rdquo; por dos razones. Una: cada celda
          cuesta dinero, y rellenar celdas que ya estan bien es tirarlo. Dos: el agente rinde
          mucho mas con un encargo estrecho —{" "}
          <i>&ldquo;busca adyacencias para Produccion&rdquo;</i> — que con uno inmenso.
          <br />
          <br />
          <b className="text-[#cbd4d2]">Fragmentos por celda</b> es el tope que le pides. Puede
          entregar menos: tiene prohibido rellenar por cuota.{" "}
          <b className="text-[#cbd4d2]">Instruccion para esta corrida</b> es una nota suelta
          para afinar el encargo sin tocar el brief.
        </Def>

        <Def term="Cola de revision">
          Aqui aterriza <b className="text-[#cbd4d2]">todo</b> lo que propone el agente. Nada
          entra al mapa por su cuenta. Cada propuesta trae su texto, la celda donde el agente
          la puso, su verificacion, la fuente que consulto y una linea de{" "}
          <i>por que aqui</i> explicando su razonamiento.
          <br />
          <br />
          Puedes corregir las tres cosas antes de decidir: el texto, la celda y la
          verificacion. Luego <b className="text-[#cbd4d2]">Aceptar</b> —pasa al mapa— o{" "}
          <b className="text-[#cbd4d2]">Descartar</b>.
          <br />
          <br />
          Existe como paso separado porque es la frontera de responsabilidad. El mapa es un
          documento que el equipo va a defender ante Cabot y ante los mentores; que una maquina
          escriba directamente en el rompe esa cadena. Las propuestas tambien se ven sobre el
          mapa, como papelitos amarillos, si prefieres decidir mirando el contexto.
        </Def>

        <Def term="Avisarme cuando termine">
          Una corrida tarda minutos. Activa las notificaciones y el telefono te avisa cuando
          haya propuestas por revisar, en vez de quedarte mirando la pantalla.
        </Def>

        <Def term="Corridas recientes">
          El historial: cuantos fragmentos salieron, cuantos resultados web consumio, cuantos
          tokens, cuanto costo y con que modelo. Sirve para dos cosas — comparar modelos con
          datos, y saber en que se va el dinero.
        </Def>
      </Section>

      {/* ── Fuentes ───────────────────────────────────────────────────────── */}
      <Section title="Fuentes y preguntas">
        <Def term="Banco de preguntas">
          Lo que no se pudo verificar <b className="text-[#cbd4d2]">no se rellena, se
          pregunta</b>. Cuando el agente encuentra un vacio —el costo por metro cubico, la
          especificacion de calidad de las torres— escribe la pregunta aqui en lugar de
          inventarse una cifra plausible. Tu tambien puedes anotar preguntas, y guardar la
          respuesta cuando la empresa conteste.
          <br />
          <br />
          Es la diferencia entre un mapa honesto y uno que se ve completo pero esta lleno de
          numeros inventados que nadie recuerda haber inventado.
        </Def>

        <Def term="Bibliografia">
          Toda afirmacion del mapa deberia poder rastrearse hasta aqui. El agente agrega solo
          las fuentes que realmente consulto. Cada entrada muestra cuantos fragmentos se
          apoyan en ella.
        </Def>
      </Section>

      {/* ── Equipo ────────────────────────────────────────────────────────── */}
      <Section title="Equipo y Administracion">
        <p>
          <b className="text-[#cbd4d2]">Equipo</b> dice quien entra a este proyecto. Tres
          roles: <i>Responsable</i> (manda, invita), <i>Editor</i> (edita el mapa y lanza el
          agente) y <i>Lector</i> (mira y no toca) — util para un mentor o para alguien de la
          empresa.
        </p>
        <p>
          <b className="text-[#cbd4d2]">Administracion</b> solo la ve el administrador de la
          instancia. No hay registro abierto: las cuentas se crean ahi a mano. Para invitar a
          alguien a un proyecto, primero tiene que existir como usuario.
        </p>
      </Section>

      {/* ── Recorrido ─────────────────────────────────────────────────────── */}
      <Section title="Un recorrido tipico">
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          <li>Llenas el brief en Configurar. Media hora bien invertida.</li>
          <li>Abres el mapa y miras que celdas estan rayadas.</li>
          <li>
            Vas al agente, marcas esas celdas, pides 4 fragmentos por celda y lanzas.
          </li>
          <li>Te avisa cuando termina. Revisas la cola: aceptas, corriges o descartas.</li>
          <li>
            Miras las preguntas que dejo y decides cuales llevarle a la empresa.
          </li>
          <li>Repites con otras celdas hasta que ninguna quede rayada.</li>
          <li>
            <b className="text-[#cbd4d2]">Recien ahi</b> el equipo se sienta a leer el mapa
            lleno y buscar insights. Ese es el momento del metodo, y no se adelanta.
          </li>
        </ol>
      </Section>

      <p className="mt-10 border-t border-[rgba(232,227,216,0.12)] pt-6 text-[12.5px] text-[#7f8f8c]">
        La fuente de verdad metodologica es el material de IXL Center / GIMI. Si algo aqui lo
        contradice, manda el material oficial.{" "}
        <Link href="/proyectos" className="text-accent underline">
          Volver a los proyectos
        </Link>
        .
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 border-b border-[rgba(232,227,216,0.14)] pb-2 text-[18px] font-bold tracking-[-0.01em] text-[#e8e3d8]">
        {title}
      </h2>
      <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-[#a9b5b3]">
        {children}
      </div>
    </section>
  );
}

function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-[4px] border-l-2 border-accent bg-panel px-4 py-3.5">
      <h3 className="mb-1.5 text-[14px] font-semibold text-[#e8e3d8]">{term}</h3>
      <div className="text-[13px] leading-relaxed text-[#a9b5b3]">{children}</div>
    </div>
  );
}
