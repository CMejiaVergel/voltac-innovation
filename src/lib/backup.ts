import "server-only";

import { prisma } from "@/lib/db";
import { uniqueSlug } from "@/lib/projects";
import { crearZip, leerZip, type EntradaZip } from "@/lib/zip";
import type { SessionUser } from "@/lib/auth";

/**
 * Respaldo completo de un proyecto.
 *
 * Es DISTINTO de la exportacion de `/api/proyectos/[slug]/export`, que produce
 * un JSON legible para compartir: aquel descarta lo rechazado y no guarda ids,
 * asi que no se puede restaurar. Este guarda todo, con ids, para poder volver
 * atras cuando alguien —o el agente— rompa algo.
 *
 * Que se guarda y por que:
 *   - La PLANTILLA viaja dentro. Las plantillas son datos, no codigo, y un
 *     respaldo restaurado en otra instalacion no puede asumir que exista.
 *   - El HISTORIAL viaja entero, incluidas las revisiones huerfanas de
 *     fragmentos ya borrados. Un respaldo que pierde la auditoria no sirve
 *     para lo unico que se le va a pedir: saber que paso.
 *   - Los fragmentos RECHAZADOS tambien. Un rechazo es una decision del
 *     equipo, no basura.
 *
 * El formato lleva version. Si algun dia cambia, un respaldo viejo tiene que
 * poder decir en que version se escribio antes de que intentemos leerlo.
 */

export const VERSION_RESPALDO = 1;

const ARCHIVOS = {
  manifiesto: "manifiesto.json",
  proyecto: "proyecto.json",
  plantilla: "plantilla.json",
  fragmentos: "fragmentos.json",
  historial: "historial.json",
  fuentes: "fuentes.json",
  preguntas: "preguntas.json",
  insights: "insights.json",
  conceptos: "conceptos.json",
  artefactos: "artefactos.json",
  presentaciones: "presentaciones.json",
  lecciones: "lecciones.json",
  corridas: "corridas.json",
  leeme: "LEEME.txt",
} as const;

const LEEME = `RESPALDO DE PROYECTO — Plataforma de Innovacion Voltac
=======================================================

Este archivo es un respaldo completo y restaurable de un proyecto de
innovacion. Adentro hay JSON plano: se puede leer con cualquier editor de
texto, sin la aplicacion.

QUE HAY EN CADA ARCHIVO

  manifiesto.json   Version del formato, fecha y conteos para verificar.
  proyecto.json     Nombre, empresa, programa y el brief (etapa Configurar).
  plantilla.json    Las filas y columnas del mapa. Viaja aqui porque la
                    plantilla es un dato, no parte del programa.
  fragmentos.json   Todos los fragmentos del mapa, incluidos los rechazados
                    y los ocultos, con su estado de verificacion.
  historial.json    Cada cambio hecho sobre cada fragmento, incluidas las
                    revisiones de fragmentos ya borrados.
  fuentes.json      La bibliografia del proyecto.
  preguntas.json    El banco de preguntas abiertas.
  insights.json     Los insights de la etapa Combinar, con los puntos que
                    conectan y las ideas que abren.
  conceptos.json    Los conceptos de Convergir, con su puntuacion, las ideas
                    de las que salen y los supuestos de los que dependen.
  artefactos.json   Los artefactos de innovacion: el documento, los supuestos
                    que exponen, sus cifras y lo que respondio la empresa.
  presentaciones.json  La presentacion del proyecto, tal como se expuso.
  lecciones.json    Lecciones aprendidas y siguientes pasos de cada sesion.
  corridas.json     Las ejecuciones del agente investigador y su costo.

COMO SE RESTAURA

  En la plataforma: Proyectos -> Importar respaldo, y se elige este archivo.

  La importacion SIEMPRE crea un proyecto nuevo. Nunca pisa uno existente:
  si el nombre ya esta ocupado, el proyecto entra con un nombre distinto.
  Recuperar consiste en importar y comparar, no en sobrescribir.

QUE NO VIAJA

  Las personas. Los miembros del equipo no se restauran: quien importa el
  respaldo queda como propietario del proyecto nuevo. Los nombres de autor
  se conservan como texto para que la trazabilidad no se pierda.
`;

// ─────────────────────────────────────────────────────────────────────────────
// Escribir
// ─────────────────────────────────────────────────────────────────────────────

/** Arma el ZIP de respaldo de un proyecto. Devuelve el archivo y su nombre. */
export async function crearRespaldo(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      brief: true,
      sources: true,
      openQuestions: { orderBy: { position: "asc" } },
      maps: { include: { template: true } },
      researchRuns: true,
    },
  });
  if (!project) throw new Error("El proyecto no existe.");

  const map = project.maps[0] ?? null;

  const fragments = map
    ? await prisma.fragment.findMany({
        where: { mapId: map.id },
        include: { author: { select: { email: true, name: true } } },
        orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
      })
    : [];

  const revisions = map
    ? await prisma.fragmentRevision.findMany({
        where: { mapId: map.id },
        include: { editedBy: { select: { email: true, name: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const insights = await prisma.insight.findMany({
    where: { projectId },
    include: {
      dots: { orderBy: { position: "asc" } },
      ideas: { orderBy: { position: "asc" } },
      author: { select: { email: true, name: true } },
    },
    orderBy: { position: "asc" },
  });

  const conceptos = await prisma.concept.findMany({
    where: { projectId },
    include: {
      origenes: { orderBy: { createdAt: "asc" } },
      supuestos: { orderBy: { position: "asc" } },
      anclas: { orderBy: { position: "asc" } },
      author: { select: { email: true } },
    },
    orderBy: { position: "asc" },
  });

  const artefactos = await prisma.artifact.findMany({
    where: { projectId },
    include: {
      supuestos: { select: { assumptionId: true } },
      cifras: { orderBy: { position: "asc" } },
      reacciones: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { email: true } } },
      },
    },
    orderBy: { position: "asc" },
  });

  const presentaciones = await prisma.deck.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  const lecciones = await prisma.leccion.findMany({
    where: { projectId },
    orderBy: [{ sesion: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    include: { author: { select: { email: true } } },
  });

  const manifiesto = {
    formato: "voltac-innovacion/respaldo",
    version: VERSION_RESPALDO,
    creadoEn: new Date().toISOString(),
    proyecto: { slug: project.slug, nombre: project.name },
    conteos: {
      fragmentos: fragments.length,
      revisiones: revisions.length,
      fuentes: project.sources.length,
      preguntas: project.openQuestions.length,
      insights: insights.length,
      conceptos: conceptos.length,
      artefactos: artefactos.length,
      presentaciones: presentaciones.length,
      lecciones: lecciones.length,
      corridas: project.researchRuns.length,
    },
  };

  const entradas: EntradaZip[] = [
    { nombre: ARCHIVOS.leeme, contenido: LEEME },
    { nombre: ARCHIVOS.manifiesto, contenido: json(manifiesto) },
    {
      nombre: ARCHIVOS.proyecto,
      contenido: json({
        slug: project.slug,
        name: project.name,
        company: project.company,
        program: project.program,
        agentModel: project.agentModel,
        agentWebSearch: project.agentWebSearch,
        createdAt: project.createdAt,
        mapName: map?.name ?? null,
        brief: project.brief,
      }),
    },
    {
      nombre: ARCHIVOS.plantilla,
      contenido: json(
        map
          ? {
              key: map.template.key,
              name: map.template.name,
              description: map.template.description,
              rows: map.template.rows,
              cols: map.template.cols,
            }
          : null,
      ),
    },
    {
      nombre: ARCHIVOS.fragmentos,
      contenido: json(
        fragments.map((f) => ({
          id: f.id,
          rowId: f.rowId,
          colId: f.colId,
          text: f.text,
          position: f.position,
          hidden: f.hidden,
          items: f.items,
          verification: f.verification,
          reviewState: f.reviewState,
          origin: f.origin,
          sourceUrl: f.sourceUrl,
          sourceCitation: f.sourceCitation,
          sourceId: f.sourceId,
          agentRationale: f.agentRationale,
          authorEmail: f.author?.email ?? null,
          authorName: f.author?.name ?? null,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
      ),
    },
    {
      nombre: ARCHIVOS.historial,
      contenido: json(
        revisions.map((r) => ({
          fragmentId: r.fragmentId,
          action: r.action,
          text: r.text,
          rowId: r.rowId,
          colId: r.colId,
          verification: r.verification,
          reviewState: r.reviewState,
          note: r.note,
          editedByEmail: r.editedBy?.email ?? null,
          editedByName: r.editedBy?.name ?? null,
          createdAt: r.createdAt,
        })),
      ),
    },
    { nombre: ARCHIVOS.fuentes, contenido: json(project.sources) },
    { nombre: ARCHIVOS.preguntas, contenido: json(project.openQuestions) },
    {
      nombre: ARCHIVOS.insights,
      contenido: json(
        insights.map((i) => ({
          tag: i.tag,
          color: i.color,
          statement: i.statement,
          pattern: i.pattern,
          fact: i.fact,
          implication: i.implication,
          business: i.business,
          limitNote: i.limitNote,
          offerWho: i.offerWho,
          offerProof: i.offerProof,
          payWho: i.payWho,
          payProof: i.payProof,
          reviewState: i.reviewState,
          origin: i.origin,
          hidden: i.hidden,
          position: i.position,
          authorEmail: i.author?.email ?? null,
          createdAt: i.createdAt,
          dots: i.dots.map((d) => ({
            fragmentId: d.fragmentId,
            textSnapshot: d.textSnapshot,
            rowId: d.rowId,
            colId: d.colId,
            role: d.role,
            position: d.position,
          })),
          // Con su id: los conceptos de Convergir apuntan a estas ideas y al
          // restaurar hay que poder reenlazarlos.
          ideas: i.ideas.map((n) => ({
            id: n.id,
            text: n.text,
            position: n.position,
            origin: n.origin,
          })),
        })),
      ),
    },
    {
      nombre: ARCHIVOS.conceptos,
      contenido: json(
        conceptos.map((c) => ({
          // Con su id, y el de cada supuesto: los artefactos apuntan a ellos.
          id: c.id,
          title: c.title,
          statement: c.statement,
          description: c.description,
          color: c.color,
          fraseOferta: c.fraseOferta,
          fraseMercado: c.fraseMercado,
          fraseNecesidad: c.fraseNecesidad,
          fraseEntrega: c.fraseEntrega,
          fraseProduccion: c.fraseProduccion,
          fraseModelo: c.fraseModelo,
          propuestaValor: c.propuestaValor,
          lienzo: c.lienzo,
          atrMercado: c.atrMercado,
          atrOpciones: c.atrOpciones,
          atrRecompensa: c.atrRecompensa,
          fitViabilidad: c.fitViabilidad,
          fitEstrategia: c.fitEstrategia,
          fitPasion: c.fitPasion,
          reviewState: c.reviewState,
          origin: c.origin,
          hidden: c.hidden,
          position: c.position,
          authorEmail: c.author?.email ?? null,
          origenes: c.origenes.map((o) => ({
            ideaId: o.ideaId,
            textSnapshot: o.textSnapshot,
            insightId: o.insightId,
          })),
          anclas: c.anclas.map((a) => ({
            fragmentId: a.fragmentId,
            rowId: a.rowId,
            textSnapshot: a.textSnapshot,
            position: a.position,
          })),
          supuestos: c.supuestos.map((a) => ({
            id: a.id,
            text: a.text,
            kind: a.kind,
            trigger: a.trigger,
            critical: a.critical,
            failFastTest: a.failFastTest,
            expectedResult: a.expectedResult,
            likelihood: a.likelihood,
            status: a.status,
            note: a.note,
            position: a.position,
            origin: a.origin,
          })),
        })),
      ),
    },
    {
      nombre: ARCHIVOS.artefactos,
      contenido: json(
        artefactos.map((a) => ({
          conceptId: a.conceptId,
          title: a.title,
          kind: a.kind,
          promise: a.promise,
          html: a.html,
          iteration: a.iteration,
          status: a.status,
          presentedAt: a.presentedAt,
          presentedTo: a.presentedTo,
          origin: a.origin,
          position: a.position,
          supuestos: a.supuestos.map((x) => x.assumptionId),
          cifras: a.cifras.map((c) => ({
            value: c.value,
            label: c.label,
            kind: c.kind,
            basis: c.basis,
            fragmentId: c.fragmentId,
            position: c.position,
          })),
          reacciones: a.reacciones.map((r) => ({
            source: r.source,
            text: r.text,
            assumptionId: r.assumptionId,
            verdict: r.verdict,
            authorEmail: r.author?.email ?? null,
            createdAt: r.createdAt,
          })),
        })),
      ),
    },
    {
      nombre: ARCHIVOS.presentaciones,
      contenido: json(
        presentaciones.map((d) => ({
          title: d.title,
          subtitle: d.subtitle,
          html: d.html,
          pages: d.pages,
          pageSize: d.pageSize,
          source: d.source,
          presentedAt: d.presentedAt,
          presentedTo: d.presentedTo,
        })),
      ),
    },
    {
      nombre: ARCHIVOS.lecciones,
      contenido: json(
        lecciones.map((l) => ({
          sesion: l.sesion,
          tipo: l.tipo,
          texto: l.texto,
          hecho: l.hecho,
          position: l.position,
          authorEmail: l.author?.email ?? null,
          createdAt: l.createdAt,
        })),
      ),
    },
    {
      nombre: ARCHIVOS.corridas,
      contenido: json(
        project.researchRuns.map((r) => ({
          status: r.status,
          scope: r.scope,
          model: r.model,
          inputTokens: r.inputTokens,
          outputTokens: r.outputTokens,
          webSearches: r.webSearches,
          costUsd: r.costUsd,
          rawResponse: r.rawResponse,
          error: r.error,
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
        })),
      ),
    },
  ];

  const fecha = new Date().toISOString().slice(0, 10);
  return {
    archivo: crearZip(entradas),
    nombre: `respaldo-${project.slug}-${fecha}.zip`,
    manifiesto,
  };
}

function json(v: unknown) {
  return JSON.stringify(v, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Leer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Restaura un respaldo COMO PROYECTO NUEVO.
 *
 * Nunca sobrescribe: es la misma decision que la papelera de proyectos. Un
 * respaldo puede ser mas viejo de lo que uno cree, y pisar el proyecto vivo
 * con el destruiria justo el trabajo que se queria proteger. Recuperar es
 * importar al lado y comparar.
 */
export async function restaurarRespaldo(user: SessionUser, archivo: Buffer) {
  const zip = leerZip(archivo);

  const manifiesto = leer(zip, ARCHIVOS.manifiesto);
  if (!manifiesto || manifiesto.formato !== "voltac-innovacion/respaldo") {
    throw new Error("El archivo no es un respaldo de esta plataforma.");
  }
  if (Number(manifiesto.version) > VERSION_RESPALDO) {
    throw new Error(
      `El respaldo se creo con una version mas nueva de la plataforma (v${manifiesto.version}). Actualiza antes de importarlo.`,
    );
  }

  const proyecto = leer(zip, ARCHIVOS.proyecto);
  if (!proyecto?.name) throw new Error("El respaldo no trae los datos del proyecto.");

  const plantilla = leer(zip, ARCHIVOS.plantilla);
  const fragmentos = leer(zip, ARCHIVOS.fragmentos) ?? [];
  const historial = leer(zip, ARCHIVOS.historial) ?? [];
  const fuentes = leer(zip, ARCHIVOS.fuentes) ?? [];
  const preguntas = leer(zip, ARCHIVOS.preguntas) ?? [];
  const insights = leer(zip, ARCHIVOS.insights) ?? [];
  const conceptos = leer(zip, ARCHIVOS.conceptos) ?? [];
  // Respaldos anteriores no traen estos archivos: quedan vacios, no fallan.
  const artefactos = leer(zip, ARCHIVOS.artefactos) ?? [];
  const presentaciones = leer(zip, ARCHIVOS.presentaciones) ?? [];
  const lecciones = leer(zip, ARCHIVOS.lecciones) ?? [];

  // Los autores se reconectan por correo. Si esa persona no existe en esta
  // instalacion, el campo queda vacio y el nombre sobrevive en el historial.
  const correos = new Set<string>();
  for (const f of fragmentos) if (f.authorEmail) correos.add(f.authorEmail);
  for (const r of historial) if (r.editedByEmail) correos.add(r.editedByEmail);
  for (const i of insights) if (i.authorEmail) correos.add(i.authorEmail);
  for (const c of conceptos) if (c.authorEmail) correos.add(c.authorEmail);
  for (const a of artefactos) {
    for (const r of a.reacciones ?? []) if (r.authorEmail) correos.add(r.authorEmail);
  }
  const usuarios = correos.size
    ? await prisma.user.findMany({
        where: { email: { in: [...correos] } },
        select: { id: true, email: true },
      })
    : [];
  const porCorreo = new Map(usuarios.map((u) => [u.email, u.id]));

  const nombre = `${proyecto.name} (restaurado)`;
  const slug = await uniqueSlug(nombre);

  // Plantilla: se reutiliza la del sistema si ya existe con esa clave, y si no
  // se crea. Asi un respaldo se puede abrir en una instalacion limpia.
  let templateId: string | null = null;
  if (plantilla?.key) {
    const existente = await prisma.mapTemplate.findUnique({ where: { key: plantilla.key } });
    templateId =
      existente?.id ??
      (
        await prisma.mapTemplate.create({
          data: {
            key: plantilla.key,
            name: plantilla.name ?? plantilla.key,
            description: plantilla.description ?? "",
            rows: plantilla.rows,
            cols: plantilla.cols,
          },
        })
      ).id;
  }

  const b = proyecto.brief;
  const nuevo = await prisma.project.create({
    data: {
      slug,
      name: nombre,
      company: proyecto.company ?? null,
      program: proyecto.program ?? null,
      agentModel: proyecto.agentModel ?? "",
      agentWebSearch: proyecto.agentWebSearch ?? true,
      createdById: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
      ...(templateId
        ? { maps: { create: { templateId, name: proyecto.mapName ?? undefined } } }
        : {}),
      ...(b
        ? {
            brief: {
              create: {
                challengeText: b.challengeText ?? "",
                problema: b.problema ?? "",
                porQueMotivante: b.porQueMotivante ?? "",
                meta: b.meta ?? "",
                solutionFoci: b.solutionFoci ?? "[]",
                queHacer: b.queHacer ?? "[]",
                queEvitar: b.queEvitar ?? "[]",
                restricciones: b.restricciones ?? "",
                razonDeCambio: b.razonDeCambio ?? "",
                brechaCrecimiento: b.brechaCrecimiento ?? "",
                perfilInversion: b.perfilInversion ?? "",
                agentHints: b.agentHints ?? "",
                agentExclude: b.agentExclude ?? "",
              },
            },
          }
        : {}),
    },
    include: { maps: true },
  });

  const mapId = nuevo.maps[0]?.id ?? null;

  // Fuentes primero: los fragmentos las referencian.
  const idFuente = new Map<string, string>();
  for (const s of fuentes) {
    const creada = await prisma.source.create({
      data: {
        projectId: nuevo.id,
        title: s.title,
        url: s.url ?? null,
        publisher: s.publisher ?? null,
        year: s.year ?? null,
        note: s.note ?? "",
        addedBy: s.addedBy ?? "HUMAN",
      },
    });
    idFuente.set(s.id, creada.id);
  }

  // Fragmentos. Se guarda el mapeo de ids viejos a nuevos para poder
  // reconectar despues el historial y los puntos de los insights.
  const idFragmento = new Map<string, string>();
  if (mapId) {
    for (const f of fragmentos) {
      const creado = await prisma.fragment.create({
        data: {
          mapId,
          rowId: f.rowId,
          colId: f.colId,
          text: f.text,
          position: f.position ?? 0,
          hidden: f.hidden ?? false,
          items: f.items ?? "[]",
          verification: f.verification ?? "TO_CONFIRM",
          reviewState: f.reviewState ?? "ACCEPTED",
          origin: f.origin ?? "HUMAN",
          sourceUrl: f.sourceUrl ?? null,
          sourceCitation: f.sourceCitation ?? null,
          sourceId: f.sourceId ? (idFuente.get(f.sourceId) ?? null) : null,
          agentRationale: f.agentRationale ?? null,
          authorId: f.authorEmail ? (porCorreo.get(f.authorEmail) ?? null) : null,
        },
      });
      idFragmento.set(f.id, creado.id);
    }

    // Historial. Una revision cuyo fragmento ya no existia sigue entrando con
    // fragmentId en null: es exactamente el caso que el modelo contempla.
    for (const r of historial) {
      await prisma.fragmentRevision.create({
        data: {
          mapId,
          fragmentId: r.fragmentId ? (idFragmento.get(r.fragmentId) ?? null) : null,
          action: r.action,
          text: r.text ?? null,
          rowId: r.rowId ?? null,
          colId: r.colId ?? null,
          verification: r.verification ?? null,
          reviewState: r.reviewState ?? null,
          note: r.note ?? null,
          editedById: r.editedByEmail ? (porCorreo.get(r.editedByEmail) ?? null) : null,
          createdAt: new Date(r.createdAt),
        },
      });
    }
  }

  for (const q of preguntas) {
    await prisma.openQuestion.create({
      data: {
        projectId: nuevo.id,
        text: q.text,
        askedTo: q.askedTo ?? "",
        status: q.status ?? "OPEN",
        answer: q.answer ?? "",
        origin: q.origin ?? "HUMAN",
        position: q.position ?? 0,
      },
    });
  }

  // Mapeo de ideas viejas a nuevas, para reenlazar los conceptos despues.
  const idIdea = new Map<string, string>();

  for (const i of insights) {
    const insightCreado = await prisma.insight.create({
      data: {
        projectId: nuevo.id,
        tag: i.tag ?? "",
        color: i.color ?? "",
        statement: i.statement,
        // Los respaldos anteriores a la anatomia patron/hecho/implicacion
        // traen `counterpart` y `shift`: ahi es donde estaba escrito el patron
        // y el «¿y que?». Un respaldo viejo tiene que seguir restaurandose.
        pattern: i.pattern ?? i.counterpart ?? "",
        fact: i.fact ?? "",
        implication: i.implication ?? i.shift ?? "",
        business: i.business ?? "",
        limitNote: i.limitNote ?? "",
        offerWho: i.offerWho ?? "",
        offerProof: i.offerProof ?? "",
        payWho: i.payWho ?? "",
        payProof: i.payProof ?? "",
        reviewState: i.reviewState ?? "ACCEPTED",
        origin: i.origin ?? "HUMAN",
        hidden: i.hidden ?? false,
        position: i.position ?? 0,
        authorId: i.authorEmail ? (porCorreo.get(i.authorEmail) ?? null) : null,
        dots: {
          create: (i.dots ?? []).map((d: Record<string, unknown>) => ({
            fragmentId: d.fragmentId
              ? (idFragmento.get(String(d.fragmentId)) ?? null)
              : null,
            textSnapshot: String(d.textSnapshot ?? ""),
            rowId: String(d.rowId ?? ""),
            colId: String(d.colId ?? ""),
            role: d.role === "CONTRAPARTE" ? "APERTURA" : String(d.role ?? "APOYO"),
            position: Number(d.position ?? 0),
          })),
        },
      },
      select: { id: true },
    });

    for (const n of (i.ideas ?? []) as Record<string, unknown>[]) {
      const creada = await prisma.insightIdea.create({
        data: {
          insightId: insightCreado.id,
          text: String(n.text ?? ""),
          position: Number(n.position ?? 0),
          origin: String(n.origin ?? "HUMAN"),
        },
        select: { id: true },
      });
      if (n.id) idIdea.set(String(n.id), creada.id);
    }
  }

  // ── Conceptos de Convergir ────────────────────────────────────────────────
  const idConcepto = new Map<string, string>();
  const idSupuesto = new Map<string, string>();
  for (const c of conceptos) {
    const conceptoCreado = await prisma.concept.create({
      data: {
        projectId: nuevo.id,
        title: c.title,
        statement: c.statement ?? "",
        description: c.description ?? "",
        color: c.color ?? "",
        fraseOferta: String(c.fraseOferta ?? ""),
        fraseMercado: String(c.fraseMercado ?? ""),
        fraseNecesidad: String(c.fraseNecesidad ?? ""),
        fraseEntrega: String(c.fraseEntrega ?? ""),
        fraseProduccion: String(c.fraseProduccion ?? ""),
        fraseModelo: String(c.fraseModelo ?? ""),
        propuestaValor: String(c.propuestaValor ?? ""),
        lienzo: String(c.lienzo ?? "{}"),
        // Los respaldos anteriores al Taller 3 traen los nombres viejos; se
        // renombran igual que en la migracion 20260923120000.
        atrMercado: c.atrMercado ?? c.impDemanda ?? 0,
        atrOpciones: c.atrOpciones ?? c.impEscalar ?? 0,
        atrRecompensa: c.atrRecompensa ?? c.fitProblema ?? 0,
        fitViabilidad: c.fitViabilidad ?? c.impImplementar ?? 0,
        fitEstrategia: c.fitEstrategia ?? c.fitMetas ?? 0,
        fitPasion: c.fitPasion ?? c.fitEquipo ?? 0,
        reviewState: c.reviewState ?? "ACCEPTED",
        origin: c.origin ?? "HUMAN",
        hidden: c.hidden ?? false,
        position: c.position ?? 0,
        authorId: c.authorEmail ? (porCorreo.get(c.authorEmail) ?? null) : null,
        anclas: {
          create: (c.anclas ?? []).map((a: Record<string, unknown>) => ({
            // Si el fragmento no se pudo reenlazar queda en null y la ficha lo
            // marca: la dimension pierde su sostén a la vista.
            fragmentId: a.fragmentId ? (idFragmento.get(String(a.fragmentId)) ?? null) : null,
            rowId: String(a.rowId ?? ""),
            textSnapshot: String(a.textSnapshot ?? ""),
            position: Number(a.position ?? 0),
          })),
        },
        origenes: {
          create: (c.origenes ?? []).map((o: Record<string, unknown>) => ({
            // Si la idea no se pudo reenlazar queda en null y el concepto la
            // muestra como huerfana, que es exactamente lo que es.
            ideaId: o.ideaId ? (idIdea.get(String(o.ideaId)) ?? null) : null,
            textSnapshot: String(o.textSnapshot ?? ""),
            insightId: String(o.insightId ?? ""),
          })),
        },
      },
      select: { id: true },
    });
    if (c.id) idConcepto.set(String(c.id), conceptoCreado.id);

    // Uno por uno y no anidados: hay que saber que id nuevo le toco a cada
    // supuesto viejo, porque los artefactos apuntan a ellos.
    for (const a of c.supuestos ?? []) {
      const sup = await prisma.assumption.create({
        data: {
          conceptId: conceptoCreado.id,
          text: String(a.text ?? ""),
          kind: String(a.kind ?? "CONDICION"),
          trigger: String(a.trigger ?? ""),
          critical: Boolean(a.critical ?? false),
          failFastTest: String(a.failFastTest ?? ""),
          expectedResult: String(a.expectedResult ?? ""),
          likelihood: Number(a.likelihood ?? 3),
          status: String(a.status ?? "OPEN"),
          note: String(a.note ?? ""),
          position: Number(a.position ?? 0),
          origin: String(a.origin ?? "HUMAN"),
        },
        select: { id: true },
      });
      if (a.id) idSupuesto.set(String(a.id), sup.id);
    }
  }

  // ── Artefactos de Actuar ──────────────────────────────────────────────────
  for (const a of artefactos) {
    const supuestos = ((a.supuestos ?? []) as string[])
      .map((id) => idSupuesto.get(String(id)))
      .filter((id): id is string => Boolean(id));

    await prisma.artifact.create({
      data: {
        projectId: nuevo.id,
        conceptId: a.conceptId ? (idConcepto.get(String(a.conceptId)) ?? null) : null,
        title: String(a.title ?? "Artefacto"),
        kind: String(a.kind ?? "LANDING"),
        promise: String(a.promise ?? ""),
        html: String(a.html ?? ""),
        iteration: Number(a.iteration ?? 1),
        status: String(a.status ?? "BORRADOR"),
        presentedAt: a.presentedAt ? new Date(a.presentedAt) : null,
        presentedTo: String(a.presentedTo ?? ""),
        origin: String(a.origin ?? "HUMAN"),
        position: Number(a.position ?? 0),
        supuestos: { create: [...new Set(supuestos)].map((assumptionId) => ({ assumptionId })) },
        cifras: {
          create: (a.cifras ?? []).map((c: Record<string, unknown>) => {
            const fragmentId = c.fragmentId ? (idFragmento.get(String(c.fragmentId)) ?? null) : null;
            // Si el fragmento no se pudo reenlazar, la cifra ya no puede
            // decirse hecho: se degrada igual que al crearla.
            const kind = String(c.kind ?? "ESTIMACION");
            return {
              value: String(c.value ?? ""),
              label: String(c.label ?? ""),
              kind: kind === "HECHO" && !fragmentId ? "ESTIMACION" : kind,
              basis: String(c.basis ?? ""),
              fragmentId,
              position: Number(c.position ?? 0),
            };
          }),
        },
        reacciones: {
          create: (a.reacciones ?? []).map((r: Record<string, unknown>) => ({
            source: String(r.source ?? ""),
            text: String(r.text ?? ""),
            assumptionId: r.assumptionId ? (idSupuesto.get(String(r.assumptionId)) ?? null) : null,
            verdict: String(r.verdict ?? ""),
            authorId: r.authorEmail ? (porCorreo.get(String(r.authorEmail)) ?? null) : null,
            createdAt: r.createdAt ? new Date(String(r.createdAt)) : undefined,
          })),
        },
      },
    });
  }

  // ── Lecciones aprendidas y siguientes pasos ───────────────────────────────
  for (const l of lecciones) {
    await prisma.leccion.create({
      data: {
        projectId: nuevo.id,
        sesion: String(l.sesion ?? ""),
        tipo: String(l.tipo ?? "APRENDIZAJE"),
        texto: String(l.texto ?? ""),
        hecho: Boolean(l.hecho ?? false),
        position: Number(l.position ?? 0),
        authorId: l.authorEmail ? (porCorreo.get(String(l.authorEmail)) ?? null) : null,
        createdAt: l.createdAt ? new Date(String(l.createdAt)) : undefined,
      },
    });
  }

  // ── Presentacion ──────────────────────────────────────────────────────────
  for (const d of presentaciones) {
    await prisma.deck.create({
      data: {
        projectId: nuevo.id,
        title: String(d.title ?? "Presentacion"),
        subtitle: String(d.subtitle ?? ""),
        html: String(d.html ?? ""),
        pages: Number(d.pages ?? 0),
        pageSize: String(d.pageSize ?? ""),
        source: String(d.source ?? "HUMAN"),
        presentedAt: d.presentedAt ? new Date(d.presentedAt) : null,
        presentedTo: String(d.presentedTo ?? ""),
      },
    });
  }

  return {
    slug: nuevo.slug,
    nombre: nuevo.name,
    conteos: {
      fragmentos: idFragmento.size,
      revisiones: historial.length,
      fuentes: idFuente.size,
      preguntas: preguntas.length,
      insights: insights.length,
      conceptos: conceptos.length,
      artefactos: artefactos.length,
      presentaciones: presentaciones.length,
      lecciones: lecciones.length,
    },
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function leer(zip: Map<string, string>, nombre: string): any {
  const texto = zip.get(nombre);
  if (texto === undefined) return null;
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`El archivo "${nombre}" del respaldo no es JSON valido.`);
  }
}
