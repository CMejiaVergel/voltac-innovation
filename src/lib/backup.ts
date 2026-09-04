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
          fact: i.fact,
          counterpart: i.counterpart,
          shift: i.shift,
          offerWho: i.offerWho,
          offerProof: i.offerProof,
          payWho: i.payWho,
          payProof: i.payProof,
          business: i.business,
          limitNote: i.limitNote,
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
          ideas: i.ideas.map((n) => ({ text: n.text, position: n.position, origin: n.origin })),
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

  // Los autores se reconectan por correo. Si esa persona no existe en esta
  // instalacion, el campo queda vacio y el nombre sobrevive en el historial.
  const correos = new Set<string>();
  for (const f of fragmentos) if (f.authorEmail) correos.add(f.authorEmail);
  for (const r of historial) if (r.editedByEmail) correos.add(r.editedByEmail);
  for (const i of insights) if (i.authorEmail) correos.add(i.authorEmail);
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

  for (const i of insights) {
    await prisma.insight.create({
      data: {
        projectId: nuevo.id,
        tag: i.tag ?? "",
        color: i.color ?? "",
        statement: i.statement,
        fact: i.fact ?? "",
        counterpart: i.counterpart ?? "",
        shift: i.shift ?? "",
        offerWho: i.offerWho ?? "",
        offerProof: i.offerProof ?? "",
        payWho: i.payWho ?? "",
        payProof: i.payProof ?? "",
        business: i.business ?? "",
        limitNote: i.limitNote ?? "",
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
            role: String(d.role ?? "APOYO"),
            position: Number(d.position ?? 0),
          })),
        },
        ideas: {
          create: (i.ideas ?? []).map((n: Record<string, unknown>) => ({
            text: String(n.text ?? ""),
            position: Number(n.position ?? 0),
            origin: String(n.origin ?? "HUMAN"),
          })),
        },
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
