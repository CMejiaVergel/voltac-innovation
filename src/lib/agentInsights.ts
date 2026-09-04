import "server-only";

import { prisma } from "@/lib/db";
import { canEdit, asEnum, REVIEW_STATES, DOT_ROLES, DOTS_MINIMO } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { AgentApiError } from "@/lib/agentApi";
import type { SessionUser } from "@/lib/auth";

/**
 * La mitad de `agentApi` que corresponde a la etapa Combinar.
 *
 * Vive aparte solo por tamaño: son las mismas reglas y el mismo contrato. Un
 * agente externo escribe insights por aqui, y pasa por los mismos controles que
 * la interfaz — acceso por proyecto, minimo de puntos, y los puntos tienen que
 * ser fragmentos reales de ESTE mapa.
 */

export type IncomingInsight = {
  enunciado: string;
  /** Ids de fragmento del mapa, en el orden del recorrido. */
  puntos: { fragmentoId: string; papel?: string }[];
  etiqueta?: string | null;
  /** Color del trazo en #rrggbb. Vacio = el de la paleta segun posicion. */
  color?: string | null;
  hecho?: string | null;
  contraparte?: string | null;
  giro?: string | null;
  ofreceQuien?: string | null;
  ofrecePrueba?: string | null;
  pagaQuien?: string | null;
  pagaPrueba?: string | null;
  negocio?: string | null;
  limite?: string | null;
  ideas?: string[];
};

async function accesoDeEscritura(user: SessionUser, projectId: string) {
  const access = await getProjectRole(user, projectId);
  if (!access) throw new AgentApiError("El proyecto no existe.", 404);
  if (!canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }
}

/**
 * Crea insights en lote.
 *
 * Dos reglas, las mismas que la interfaz y por el mismo motivo:
 *
 *   1. Minimo de puntos: con uno solo no se combina nada, se glosa.
 *   2. Los puntos tienen que existir en ESTE mapa. Un id inventado —o de otro
 *      proyecto— tumba el insight entero en vez de crearlo cojo: si una de sus
 *      patas es imaginaria, el insight no se sostiene, y guardarlo a medias es
 *      peor que rechazarlo con el motivo escrito.
 *
 * Por defecto entra como PROPOSED: un agente propone, una persona acepta.
 */
export async function createInsights(
  user: SessionUser,
  slug: string,
  items: IncomingInsight[],
  estado: "PROPOSED" | "ACCEPTED" = "PROPOSED",
) {
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) throw new AgentApiError(`No existe el proyecto "${slug}".`, 404);
  await accesoDeEscritura(user, project.id);

  const map = await prisma.bomMap.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!map) throw new AgentApiError("El proyecto no tiene mapa.", 409);

  const validos = await prisma.fragment.findMany({
    where: { mapId: map.id },
    select: { id: true, text: true, rowId: true, colId: true },
  });
  const porId = new Map(validos.map((f) => [f.id, f]));

  const existentes = await prisma.insight.findMany({
    where: { projectId: project.id },
    select: { statement: true },
  });
  const yaEscritos = new Set(existentes.map((e) => normalizar(e.statement)));

  let posicion = (await ultimaPosicion(project.id)) + 1;

  const creados: string[] = [];
  const rechazados: { enunciado: string; motivo: string }[] = [];

  for (const item of items) {
    const enunciado = (item.enunciado ?? "").trim();

    if (enunciado.length < 20) {
      rechazados.push({
        enunciado,
        motivo: "El enunciado es demasiado corto para ser concluyente.",
      });
      continue;
    }
    if (yaEscritos.has(normalizar(enunciado))) {
      rechazados.push({ enunciado, motivo: "Ya existe un insight con ese enunciado." });
      continue;
    }

    const puntos = item.puntos ?? [];
    const faltantes = puntos.filter((p) => !porId.has(p.fragmentoId)).map((p) => p.fragmentoId);
    if (faltantes.length > 0) {
      rechazados.push({
        enunciado,
        motivo: `Cita puntos que no estan en el mapa de este proyecto: ${faltantes.join(", ")}.`,
      });
      continue;
    }

    const unicos = sinRepetir(puntos);
    if (unicos.length < DOTS_MINIMO) {
      rechazados.push({
        enunciado,
        motivo: `Conecta ${unicos.length} punto(s); hacen falta al menos ${DOTS_MINIMO}.`,
      });
      continue;
    }

    const insight = await prisma.insight.create({
      data: {
        projectId: project.id,
        authorId: user.id,
        origin: "AGENT",
        reviewState: estado,
        position: posicion++,
        statement: enunciado,
        tag: (item.etiqueta ?? "").slice(0, 40),
        color: colorValido(item.color),
        fact: item.hecho ?? "",
        counterpart: item.contraparte ?? "",
        shift: item.giro ?? "",
        offerWho: item.ofreceQuien ?? "",
        offerProof: item.ofrecePrueba ?? "",
        payWho: item.pagaQuien ?? "",
        payProof: item.pagaPrueba ?? "",
        business: item.negocio ?? "",
        limitNote: item.limite ?? "",
        dots: { create: unicos.map((p, i) => aDot(porId.get(p.fragmentoId)!, p.papel, i)) },
        ideas: {
          create: (item.ideas ?? []).map((text, i) => ({
            text: text.slice(0, 400),
            position: i,
            origin: "AGENT",
          })),
        },
      },
      select: { id: true, statement: true },
    });

    yaEscritos.add(normalizar(enunciado));
    creados.push(insight.id);
  }

  // Solo los ids: el enunciado acaba de enviarlo quien llama.
  return { creados: creados.length, rechazados, ids: creados };
}

/** Corrige un insight existente: campos, puntos e ideas. */
export async function updateInsightById(
  user: SessionUser,
  insightId: string,
  cambios: Partial<IncomingInsight> & { estado?: string },
) {
  const insight = await prisma.insight.findUnique({
    where: { id: insightId },
    include: { project: { select: { id: true } } },
  });
  if (!insight) throw new AgentApiError("El insight no existe.", 404);
  await accesoDeEscritura(user, insight.project.id);

  const data: Record<string, unknown> = {};
  const CAMPOS: [keyof IncomingInsight, string][] = [
    ["enunciado", "statement"],
    ["etiqueta", "tag"],
    ["color", "color"],
    ["hecho", "fact"],
    ["contraparte", "counterpart"],
    ["giro", "shift"],
    ["ofreceQuien", "offerWho"],
    ["ofrecePrueba", "offerProof"],
    ["pagaQuien", "payWho"],
    ["pagaPrueba", "payProof"],
    ["negocio", "business"],
    ["limite", "limitNote"],
  ];
  for (const [entra, campo] of CAMPOS) {
    const v = cambios[entra];
    if (typeof v === "string") data[campo] = v.trim();
  }
  if (cambios.estado) data.reviewState = asEnum(REVIEW_STATES, cambios.estado, "PROPOSED");
  if (data.statement === "") throw new AgentApiError("El insight necesita su frase.", 400);
  if ("color" in data) data.color = colorValido(data.color as string);

  // Los puntos se reemplazan enteros cuando vienen: asi el agente rehace el
  // recorrido de una vez, en vez de dejarlo a medio conectar.
  if (cambios.puntos) {
    const map = await prisma.bomMap.findFirst({
      where: { projectId: insight.project.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!map) throw new AgentApiError("El proyecto no tiene mapa.", 409);

    const unicos = sinRepetir(cambios.puntos);
    if (unicos.length < DOTS_MINIMO) {
      throw new AgentApiError(`Hacen falta al menos ${DOTS_MINIMO} puntos.`, 400);
    }

    const validos = await prisma.fragment.findMany({
      where: { mapId: map.id, id: { in: unicos.map((p) => p.fragmentoId) } },
      select: { id: true, text: true, rowId: true, colId: true },
    });
    const porId = new Map(validos.map((f) => [f.id, f]));
    const faltantes = unicos.filter((p) => !porId.has(p.fragmentoId));
    if (faltantes.length > 0) {
      throw new AgentApiError(
        `Cita puntos que no estan en el mapa: ${faltantes.map((p) => p.fragmentoId).join(", ")}.`,
        400,
      );
    }

    await prisma.insightDot.deleteMany({ where: { insightId } });
    data.dots = { create: unicos.map((p, i) => aDot(porId.get(p.fragmentoId)!, p.papel, i)) };
  }

  if (cambios.ideas) {
    await prisma.insightIdea.deleteMany({ where: { insightId } });
    data.ideas = {
      create: cambios.ideas.map((text, i) => ({
        text: text.slice(0, 400),
        position: i,
        origin: "AGENT",
      })),
    };
  }

  const actualizado = await prisma.insight.update({
    where: { id: insightId },
    data,
    include: { dots: true, ideas: true },
  });

  return {
    id: actualizado.id,
    puntos: actualizado.dots.length,
    ideas: actualizado.ideas.length,
  };
}

export async function deleteInsightById(user: SessionUser, insightId: string) {
  const insight = await prisma.insight.findUnique({
    where: { id: insightId },
    include: { project: { select: { id: true } } },
  });
  if (!insight) throw new AgentApiError("El insight no existe.", 404);
  await accesoDeEscritura(user, insight.project.id);

  await prisma.insight.delete({ where: { id: insightId } });
  return { eliminado: insightId };
}

/** Fija el orden del tablero de insights. */
export async function orderInsights(user: SessionUser, slug: string, ids: string[]) {
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) throw new AgentApiError(`No existe el proyecto "${slug}".`, 404);
  await accesoDeEscritura(user, project.id);

  const propios = await prisma.insight.findMany({
    where: { projectId: project.id },
    select: { id: true },
  });
  const validos = new Set(propios.map((i) => i.id));
  const ajenos = ids.filter((id) => !validos.has(id));
  if (ajenos.length > 0) {
    throw new AgentApiError(`Estos insights no son del proyecto: ${ajenos.join(", ")}.`, 400);
  }

  await prisma.$transaction(
    ids.map((id, i) => prisma.insight.update({ where: { id }, data: { position: i } })),
  );
  return { ordenados: ids.length };
}

// ─────────────────────────────────────────────────────────────────────────────

function aDot(
  f: { id: string; text: string; rowId: string; colId: string },
  papel: string | undefined,
  i: number,
) {
  return {
    fragmentId: f.id,
    textSnapshot: f.text,
    rowId: f.rowId,
    colId: f.colId,
    role: asEnum(DOT_ROLES, papel ?? "APOYO", "APOYO"),
    position: i,
  };
}

function sinRepetir<T extends { fragmentoId: string }>(puntos: T[]): T[] {
  const vistos = new Set<string>();
  return puntos.filter((p) => {
    if (vistos.has(p.fragmentoId)) return false;
    vistos.add(p.fragmentoId);
    return true;
  });
}

/**
 * Un color solo entra como #rrggbb. Cualquier otra cosa se guarda vacia, que
 * significa "usa la paleta": es mejor caer al color por posicion que dejar el
 * trazo con un valor que el navegador no sabe pintar.
 */
function colorValido(v: string | null | undefined): string {
  const c = (v ?? "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(c) ? c : "";
}

/** Compara sin acentos, mayusculas ni puntuacion, para detectar repeticiones. */
function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function ultimaPosicion(projectId: string) {
  const ultimo = await prisma.insight.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return ultimo?.position ?? -1;
}
