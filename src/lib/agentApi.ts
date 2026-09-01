import "server-only";

import { prisma } from "@/lib/db";
import { canEdit, asEnum, VERIFICATIONS, REVIEW_STATES } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { parseShape, isValidCoord, type TemplateShape } from "@/lib/templates";
import type { SessionUser } from "@/lib/auth";

/**
 * Operaciones que un agente externo puede ejecutar sobre un proyecto.
 *
 * Es la misma capa de reglas que usa la interfaz: control de acceso por
 * proyecto, validacion de coordenadas contra la plantilla e historial
 * obligatorio en cada escritura. El servidor MCP no habla con la base de
 * datos: habla con esto, a traves de las rutas /api/agent.
 */

export class AgentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AgentApiError";
  }
}

async function loadProject(user: SessionUser, slug: string, needsWrite: boolean) {
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { brief: true },
  });
  if (!project) throw new AgentApiError(`No existe el proyecto "${slug}".`, 404);

  const access = await getProjectRole(user, project.id);
  if (!access) throw new AgentApiError(`No existe el proyecto "${slug}".`, 404);
  if (needsWrite && !canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }

  return project;
}

async function loadMap(projectId: string) {
  const map = await prisma.bomMap.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { template: true },
  });
  if (!map) throw new AgentApiError("El proyecto no tiene mapa.", 409);
  return { map, shape: parseShape(map.template.rows, map.template.cols) as TemplateShape };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura
// ─────────────────────────────────────────────────────────────────────────────

export async function listProjects(user: SessionUser) {
  const where = user.role === "ADMIN" ? {} : { members: { some: { userId: user.id } } };
  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { maps: { select: { _count: { select: { fragments: true } } } } },
  });

  return projects.map((p) => ({
    slug: p.slug,
    nombre: p.name,
    empresa: p.company,
    programa: p.program,
    estado: p.status,
    fragmentos: p.maps.reduce((a, m) => a + m._count.fragments, 0),
  }));
}

/** Todo lo que un agente necesita saber antes de proponer nada. */
export async function getProjectContext(user: SessionUser, slug: string) {
  const project = await loadProject(user, slug, false);
  const { map, shape } = await loadMap(project.id);

  const fragments = await prisma.fragment.findMany({
    where: { mapId: map.id, reviewState: { in: ["ACCEPTED", "PROPOSED"] } },
    orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
    include: { source: { select: { title: true, url: true } } },
  });

  const parseList = (raw: string) => {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  };

  const celdas = shape.rows.flatMap((r) =>
    shape.cols.map((c) => {
      const items = fragments.filter((f) => f.rowId === r.id && f.colId === c.id);
      return {
        fila: r.id,
        columna: c.id,
        nombre: `${r.name} × ${c.name}`,
        aceptados: items.filter((f) => f.reviewState === "ACCEPTED").length,
        propuestos: items.filter((f) => f.reviewState === "PROPOSED").length,
      };
    }),
  );

  return {
    proyecto: {
      slug: project.slug,
      nombre: project.name,
      empresa: project.company,
      programa: project.program,
    },
    brief: project.brief && {
      reto: project.brief.challengeText,
      problema: project.brief.problema,
      porQueMotivante: project.brief.porQueMotivante,
      meta: project.brief.meta,
      queHacer: parseList(project.brief.queHacer),
      queEvitar: parseList(project.brief.queEvitar),
      restricciones: project.brief.restricciones,
      brechaCrecimiento: project.brief.brechaCrecimiento,
      priorizarEnBusqueda: project.brief.agentHints,
      excluirDeBusqueda: project.brief.agentExclude,
    },
    plantilla: {
      key: map.template.key,
      filas: shape.rows.map((r) => ({ id: r.id, nombre: r.name, facetas: r.facets })),
      columnas: shape.cols.map((c) => ({
        id: c.id,
        nombre: c.name,
        pregunta: c.question,
        regla: c.hint,
      })),
    },
    celdas,
    fragmentos: fragments.map((f) => ({
      id: f.id,
      fila: f.rowId,
      columna: f.colId,
      texto: f.text,
      verificacion: f.verification,
      estado: f.reviewState,
      origen: f.origin,
      fuenteUrl: f.sourceUrl ?? f.source?.url ?? null,
      fuenteCita: f.sourceCitation ?? f.source?.title ?? null,
      porQueAqui: f.agentRationale,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Escritura de fragmentos
// ─────────────────────────────────────────────────────────────────────────────

export type IncomingFragment = {
  fila: string;
  columna: string;
  texto: string;
  verificacion?: string;
  fuenteUrl?: string | null;
  fuenteCita?: string | null;
  porQueAqui?: string | null;
};

/**
 * Crea fragmentos en lote.
 *
 * `estado` por defecto es PROPOSED: un agente propone, una persona acepta. Se
 * puede pedir ACCEPTED de forma explicita para trabajos de curaduria donde la
 * revision ya ocurrio fuera de la aplicacion.
 */
export async function createFragments(
  user: SessionUser,
  slug: string,
  items: IncomingFragment[],
  estado: "PROPOSED" | "ACCEPTED" = "PROPOSED",
) {
  const project = await loadProject(user, slug, true);
  const { map, shape } = await loadMap(project.id);

  const existing = await prisma.fragment.findMany({
    where: { mapId: map.id },
    select: { rowId: true, colId: true, text: true, position: true },
  });

  const seen = new Set(existing.map((f) => normalize(f.text)));
  const nextPos = new Map<string, number>();
  for (const f of existing) {
    const k = `${f.rowId}|${f.colId}`;
    nextPos.set(k, Math.max(nextPos.get(k) ?? -1, f.position));
  }

  const creados: Array<{ id: string; fila: string; columna: string; texto: string }> = [];
  const rechazados: Array<{ texto: string; motivo: string }> = [];

  for (const item of items) {
    const texto = (item.texto ?? "").trim();
    if (!texto) {
      rechazados.push({ texto: "", motivo: "Texto vacio." });
      continue;
    }
    if (!isValidCoord(shape, item.fila, item.columna)) {
      rechazados.push({
        texto,
        motivo: `La celda ${item.fila}|${item.columna} no existe en la plantilla.`,
      });
      continue;
    }
    const key = normalize(texto);
    if (seen.has(key)) {
      rechazados.push({ texto, motivo: "Ya existe un fragmento igual en el mapa." });
      continue;
    }
    seen.add(key);

    const cell = `${item.fila}|${item.columna}`;
    const position = (nextPos.get(cell) ?? -1) + 1;
    nextPos.set(cell, position);

    const sourceId = await resolveSource(project.id, item);

    // Verificado exige una FUENTE IDENTIFICADA, no necesariamente una URL: un
    // documento que el equipo tiene en la mano —la presentacion del reto, una
    // norma en PDF— es una cita legitima. Lo que no se admite es afirmar que
    // algo esta verificado sin decir contra que.
    const pedida = asEnum(VERIFICATIONS, item.verificacion, "TO_CONFIRM");
    const conFuente = Boolean(item.fuenteUrl?.trim() || item.fuenteCita?.trim());
    const verificacion = pedida === "VERIFIED" && !conFuente ? "TO_CONFIRM" : pedida;

    const created = await prisma.fragment.create({
      data: {
        mapId: map.id,
        rowId: item.fila,
        colId: item.columna,
        text: texto,
        position,
        verification: verificacion,
        reviewState: asEnum(REVIEW_STATES, estado, "PROPOSED"),
        origin: "AGENT",
        sourceUrl: item.fuenteUrl ?? null,
        sourceCitation: item.fuenteCita ?? null,
        sourceId,
        agentRationale: item.porQueAqui ?? null,
        authorId: user.id,
        reviewedById: estado === "ACCEPTED" ? user.id : null,
        reviewedAt: estado === "ACCEPTED" ? new Date() : null,
      },
    });

    await prisma.fragmentRevision.create({
      data: {
        mapId: map.id,
        fragmentId: created.id,
        action: "CREATE",
        text: texto,
        rowId: item.fila,
        colId: item.columna,
        verification: verificacion,
        reviewState: estado,
        note: `Creado por agente externo (${user.name})`,
        editedById: user.id,
      },
    });

    creados.push({ id: created.id, fila: item.fila, columna: item.columna, texto });
  }

  return { creados: creados.length, rechazados, detalle: creados };
}

export async function updateFragment(
  user: SessionUser,
  id: string,
  patch: {
    texto?: string;
    fila?: string;
    columna?: string;
    verificacion?: string;
    estado?: string;
    fuenteUrl?: string | null;
    fuenteCita?: string | null;
    porQueAqui?: string | null;
  },
) {
  const fragment = await prisma.fragment.findUnique({
    where: { id },
    include: { map: { include: { template: true, project: { select: { slug: true } } } } },
  });
  if (!fragment) throw new AgentApiError("El fragmento no existe.", 404);

  await loadProject(user, fragment.map.project.slug, true);
  const shape = parseShape(fragment.map.template.rows, fragment.map.template.cols);

  const rowId = patch.fila ?? fragment.rowId;
  const colId = patch.columna ?? fragment.colId;
  if (!isValidCoord(shape, rowId, colId)) {
    throw new AgentApiError(`La celda ${rowId}|${colId} no existe en la plantilla.`, 400);
  }

  const texto = patch.texto?.trim() ?? fragment.text;
  if (!texto) throw new AgentApiError("El fragmento no puede quedar vacio.", 400);

  const moved = rowId !== fragment.rowId || colId !== fragment.colId;
  const updated = await prisma.fragment.update({
    where: { id },
    data: {
      text: texto,
      rowId,
      colId,
      verification: asEnum(
        VERIFICATIONS,
        patch.verificacion,
        fragment.verification as (typeof VERIFICATIONS)[number],
      ),
      reviewState: asEnum(
        REVIEW_STATES,
        patch.estado,
        fragment.reviewState as (typeof REVIEW_STATES)[number],
      ),
      sourceUrl: patch.fuenteUrl !== undefined ? patch.fuenteUrl : fragment.sourceUrl,
      sourceCitation:
        patch.fuenteCita !== undefined ? patch.fuenteCita : fragment.sourceCitation,
      agentRationale:
        patch.porQueAqui !== undefined ? patch.porQueAqui : fragment.agentRationale,
    },
  });

  await prisma.fragmentRevision.create({
    data: {
      mapId: fragment.mapId,
      fragmentId: id,
      action: moved ? "MOVE" : "EDIT",
      text: texto,
      rowId,
      colId,
      verification: updated.verification,
      reviewState: updated.reviewState,
      note: `Editado por agente externo (${user.name})`,
      editedById: user.id,
    },
  });

  return { id, fila: rowId, columna: colId, texto };
}

export async function deleteFragmentById(user: SessionUser, id: string) {
  const fragment = await prisma.fragment.findUnique({
    where: { id },
    include: { map: { include: { project: { select: { slug: true } } } } },
  });
  if (!fragment) throw new AgentApiError("El fragmento no existe.", 404);

  await loadProject(user, fragment.map.project.slug, true);

  await prisma.fragmentRevision.create({
    data: {
      mapId: fragment.mapId,
      fragmentId: id,
      action: "DELETE",
      text: fragment.text,
      rowId: fragment.rowId,
      colId: fragment.colId,
      note: `Eliminado por agente externo (${user.name})`,
      editedById: user.id,
    },
  });
  await prisma.fragment.delete({ where: { id } });

  return { eliminado: id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Brief (etapa Configurar)
// ─────────────────────────────────────────────────────────────────────────────

export type BriefPatch = Partial<{
  reto: string;
  problema: string;
  porQueMotivante: string;
  meta: string;
  queHacer: string[];
  queEvitar: string[];
  restricciones: string;
  brechaCrecimiento: string;
  priorizarEnBusqueda: string;
  excluirDeBusqueda: string;
}>;

/**
 * Actualiza el brief. Solo escribe los campos presentes en el parche: el
 * agente corrige lo que investigo sin borrar lo que el equipo escribio a mano.
 */
export async function updateBriefFields(user: SessionUser, slug: string, patch: BriefPatch) {
  const project = await loadProject(user, slug, true);

  const data: Record<string, string> = {};
  const texto: Array<[keyof BriefPatch, string]> = [
    ["reto", "challengeText"],
    ["problema", "problema"],
    ["porQueMotivante", "porQueMotivante"],
    ["meta", "meta"],
    ["restricciones", "restricciones"],
    ["brechaCrecimiento", "brechaCrecimiento"],
    ["priorizarEnBusqueda", "agentHints"],
    ["excluirDeBusqueda", "agentExclude"],
  ];
  for (const [entrada, columna] of texto) {
    const v = patch[entrada];
    if (typeof v === "string") data[columna] = v.trim();
  }
  if (Array.isArray(patch.queHacer)) data.queHacer = JSON.stringify(patch.queHacer);
  if (Array.isArray(patch.queEvitar)) data.queEvitar = JSON.stringify(patch.queEvitar);

  if (Object.keys(data).length === 0) {
    throw new AgentApiError("El parche no trae ningun campo reconocido.", 400);
  }

  await prisma.brief.upsert({
    where: { projectId: project.id },
    update: data,
    create: { projectId: project.id, ...data },
  });

  return { actualizados: Object.keys(data) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Preguntas y fuentes
// ─────────────────────────────────────────────────────────────────────────────

export async function addQuestions(
  user: SessionUser,
  slug: string,
  items: Array<{ texto: string; paraQuien?: string }>,
) {
  const project = await loadProject(user, slug, true);
  let n = 0;
  for (const q of items) {
    const texto = q.texto.trim();
    if (!texto) continue;
    const dup = await prisma.openQuestion.findFirst({
      where: { projectId: project.id, text: texto },
    });
    if (dup) continue;
    await prisma.openQuestion.create({
      data: { projectId: project.id, text: texto, askedTo: q.paraQuien ?? "", origin: "AGENT" },
    });
    n++;
  }
  return { creadas: n };
}

export async function addSources(
  user: SessionUser,
  slug: string,
  items: Array<{ titulo: string; url?: string; editor?: string; anio?: string; nota?: string }>,
) {
  const project = await loadProject(user, slug, true);
  let n = 0;
  for (const s of items) {
    const title = s.titulo.trim();
    if (!title) continue;
    const dup = await prisma.source.findFirst({
      where: { projectId: project.id, OR: [{ title }, ...(s.url ? [{ url: s.url }] : [])] },
    });
    if (dup) continue;
    await prisma.source.create({
      data: {
        projectId: project.id,
        title,
        url: s.url ?? null,
        publisher: s.editor ?? null,
        year: s.anio ?? null,
        note: s.nota ?? "",
        addedBy: "AGENT",
      },
    });
    n++;
  }
  return { creadas: n };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clonar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copia completa de un proyecto: brief, plantilla, fragmentos, bibliografia y
 * preguntas. Sirve para probar sobre una replica sin arriesgar el original.
 *
 * No copia el historial de revisiones ni las corridas del agente: son el
 * registro de lo que le paso al original, y arrastrarlo mentiria sobre la
 * copia.
 */
export async function cloneProject(
  user: SessionUser,
  slug: string,
  opts: { sufijo?: string; incluirFragmentos?: boolean } = {},
) {
  const origin = await loadProject(user, slug, false);
  const { map, shape } = await loadMap(origin.id);

  const sufijo = opts.sufijo ?? "(prueba)";
  const nombre = `${origin.name} ${sufijo}`;

  const base =
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "proyecto";
  let nuevoSlug = base;
  let i = 2;
  while (await prisma.project.findUnique({ where: { slug: nuevoSlug } })) {
    nuevoSlug = `${base}-${i++}`;
  }

  const brief = origin.brief;
  const copia = await prisma.project.create({
    data: {
      slug: nuevoSlug,
      name: nombre,
      company: origin.company,
      program: origin.program,
      agentModel: origin.agentModel,
      agentWebSearch: origin.agentWebSearch,
      createdById: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
      maps: { create: { templateId: map.templateId, name: map.name } },
      ...(brief
        ? {
            brief: {
              create: {
                challengeText: brief.challengeText,
                problema: brief.problema,
                porQueMotivante: brief.porQueMotivante,
                meta: brief.meta,
                solutionFoci: brief.solutionFoci,
                queHacer: brief.queHacer,
                queEvitar: brief.queEvitar,
                restricciones: brief.restricciones,
                razonDeCambio: brief.razonDeCambio,
                brechaCrecimiento: brief.brechaCrecimiento,
                perfilInversion: brief.perfilInversion,
                agentHints: brief.agentHints,
                agentExclude: brief.agentExclude,
              },
            },
          }
        : {}),
    },
    include: { maps: true },
  });

  // Bibliografia primero: los fragmentos apuntan a ella.
  const sources = await prisma.source.findMany({ where: { projectId: origin.id } });
  const sourceMap = new Map<string, string>();
  for (const s of sources) {
    const nueva = await prisma.source.create({
      data: {
        projectId: copia.id,
        title: s.title,
        url: s.url,
        publisher: s.publisher,
        year: s.year,
        note: s.note,
        addedBy: s.addedBy,
      },
    });
    sourceMap.set(s.id, nueva.id);
  }

  const questions = await prisma.openQuestion.findMany({ where: { projectId: origin.id } });
  for (const q of questions) {
    await prisma.openQuestion.create({
      data: {
        projectId: copia.id,
        text: q.text,
        askedTo: q.askedTo,
        status: q.status,
        answer: q.answer,
        origin: q.origin,
      },
    });
  }

  let fragmentos = 0;
  if (opts.incluirFragmentos !== false) {
    const originales = await prisma.fragment.findMany({
      where: { mapId: map.id },
      orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
    });
    for (const f of originales) {
      await prisma.fragment.create({
        data: {
          mapId: copia.maps[0].id,
          rowId: f.rowId,
          colId: f.colId,
          text: f.text,
          position: f.position,
          verification: f.verification,
          reviewState: f.reviewState,
          origin: f.origin,
          sourceUrl: f.sourceUrl,
          sourceCitation: f.sourceCitation,
          sourceId: f.sourceId ? (sourceMap.get(f.sourceId) ?? null) : null,
          agentRationale: f.agentRationale,
          authorId: f.authorId,
        },
      });
      fragmentos++;
    }
  }

  return {
    slug: copia.slug,
    nombre: copia.name,
    fragmentos,
    fuentes: sources.length,
    preguntas: questions.length,
    celdas: shape.rows.length * shape.cols.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function resolveSource(projectId: string, item: IncomingFragment): Promise<string | null> {
  const url = item.fuenteUrl?.trim();
  const title = item.fuenteCita?.trim();
  if (!url && !title) return null;

  const found = url
    ? await prisma.source.findFirst({ where: { projectId, url } })
    : await prisma.source.findFirst({ where: { projectId, title: title! } });
  if (found) return found.id;

  const source = await prisma.source.create({
    data: { projectId, title: title || url || "Fuente sin titulo", url: url ?? null, addedBy: "AGENT" },
  });
  return source.id;
}
