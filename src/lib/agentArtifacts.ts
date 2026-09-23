import "server-only";

import { prisma } from "@/lib/db";
import { asEnum, canEdit, ARTIFACT_KINDS, ARTIFACT_STATUSES, CLAIM_KINDS } from "@/lib/enums";
import { getProjectRole } from "@/lib/projects";
import { AgentApiError } from "@/lib/agentApi";
import type { SessionUser } from "@/lib/auth";

/**
 * La etapa Actuar por la puerta del agente.
 *
 * Las mismas reglas que la pantalla, y ninguna se relaja por venir de un
 * agente: el artefacto cuelga de un concepto del proyecto, solo expone
 * supuestos de ESE concepto, y una cifra declarada hecho sin fragmento del mapa
 * se guarda como estimacion. La degradacion se devuelve en la respuesta para
 * que quien la envio sepa que su cifra no quedo como la pidio.
 *
 * El documento HTML no viaja por aqui. Una landing con imagenes embebidas pasa
 * con facilidad del limite de cuerpo del proxy; se carga en el servidor con
 * `npm run artefacto:cargar`.
 */

export type IncomingArtifact = {
  concepto: string;
  titulo: string;
  formato?: string;
  /** Lo que la empresa tiene que entender al verlo, en una frase. */
  promesa?: string;
  /** Ids de supuestos del concepto que el artefacto pone a la vista. */
  supuestos?: string[];
  cifras?: {
    valor: string;
    etiqueta: string;
    tipo?: string;
    base?: string;
    fragmentoId?: string | null;
  }[];
};

export async function createArtifactForAgent(user: SessionUser, slug: string, datos: IncomingArtifact) {
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) throw new AgentApiError(`No existe el proyecto "${slug}".`, 404);
  const access = await getProjectRole(user, project.id);
  if (!access) throw new AgentApiError("El proyecto no existe.", 404);
  if (!canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }

  const titulo = (datos.titulo ?? "").trim();
  if (!titulo) throw new AgentApiError("El artefacto necesita un nombre.", 400);

  const concepto = await prisma.concept.findFirst({
    where: { id: datos.concepto, projectId: project.id },
    select: { id: true, supuestos: { select: { id: true } } },
  });
  if (!concepto) {
    throw new AgentApiError("El concepto no existe en este proyecto. Un artefacto cuelga de un concepto.", 400);
  }

  const delConcepto = new Set(concepto.supuestos.map((s) => s.id));
  const supuestos = [...new Set(datos.supuestos ?? [])];
  const ajenos = supuestos.filter((id) => !delConcepto.has(id));
  if (ajenos.length > 0) {
    throw new AgentApiError(`Estos supuestos no son del concepto: ${ajenos.join(", ")}.`, 400);
  }

  const idsFragmento = [
    ...new Set((datos.cifras ?? []).map((c) => c.fragmentoId).filter((x): x is string => Boolean(x))),
  ];
  const fragmentos = idsFragmento.length
    ? await prisma.fragment.findMany({
        where: { id: { in: idsFragmento }, map: { projectId: project.id } },
        select: { id: true },
      })
    : [];
  const validos = new Set(fragmentos.map((f) => f.id));
  const inexistentes = idsFragmento.filter((id) => !validos.has(id));
  if (inexistentes.length > 0) {
    throw new AgentApiError(`Estos fragmentos no estan en el mapa: ${inexistentes.join(", ")}.`, 400);
  }

  const degradadas: string[] = [];
  const cifras = (datos.cifras ?? []).map((c, position) => {
    const valor = (c.valor ?? "").trim();
    const etiqueta = (c.etiqueta ?? "").trim();
    if (!valor || !etiqueta) throw new AgentApiError("Cada cifra necesita valor y etiqueta.", 400);
    const pedido = asEnum(CLAIM_KINDS, c.tipo, "ESTIMACION");
    const fragmentId = c.fragmentoId || null;
    const kind = pedido === "HECHO" && !fragmentId ? "ESTIMACION" : pedido;
    if (kind !== pedido) degradadas.push(valor);
    return { value: valor, label: etiqueta, kind, basis: (c.base ?? "").trim(), fragmentId, position };
  });

  const ultimo = await prisma.artifact.findFirst({
    where: { projectId: project.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const creado = await prisma.artifact.create({
    data: {
      projectId: project.id,
      conceptId: concepto.id,
      title: titulo,
      kind: asEnum(ARTIFACT_KINDS, datos.formato, "LANDING"),
      promise: (datos.promesa ?? "").trim(),
      origin: "AGENT",
      position: (ultimo?.position ?? -1) + 1,
      supuestos: { create: supuestos.map((assumptionId) => ({ assumptionId })) },
      cifras: { create: cifras },
    },
    select: { id: true, title: true },
  });

  return {
    id: creado.id,
    titulo: creado.title,
    supuestosExpuestos: supuestos.length,
    cifras: cifras.length,
    ...(degradadas.length
      ? { degradadasAEstimacion: degradadas, nota: "Declaradas hecho sin fragmento del mapa." }
      : {}),
    siguiente: `Cargar el documento con cargar_documento_artefacto (id ${creado.id}, ruta del .html local).`,
  };
}

/** Corrige los datos de un artefacto. Las cifras y los supuestos no se tocan aqui. */
export async function updateArtifactForAgent(
  user: SessionUser,
  id: string,
  cambios: {
    titulo?: string;
    promesa?: string;
    formato?: string;
    estado?: string;
    presentadoA?: string;
    /** Vuelta del ciclo hacer-probar-revisar-cambiar (el taller pide al menos siete). */
    iteracion?: number;
  },
) {
  const artefacto = await prisma.artifact.findUnique({
    where: { id },
    select: { id: true, projectId: true, presentedAt: true },
  });
  if (!artefacto) throw new AgentApiError("El artefacto no existe.", 404);
  const access = await getProjectRole(user, artefacto.projectId);
  if (!access) throw new AgentApiError("El artefacto no existe.", 404);
  if (!canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }

  const data: Record<string, unknown> = {};
  if (typeof cambios.titulo === "string" && cambios.titulo.trim()) data.title = cambios.titulo.trim();
  if (typeof cambios.promesa === "string") data.promise = cambios.promesa.trim();
  if (cambios.formato) data.kind = asEnum(ARTIFACT_KINDS, cambios.formato, "LANDING");
  if (cambios.iteracion !== undefined) {
    data.iteration = Math.min(99, Math.max(1, Math.round(Number(cambios.iteracion))));
  }
  if (typeof cambios.presentadoA === "string") data.presentedTo = cambios.presentadoA.trim();
  if (cambios.estado) {
    const estado = asEnum(ARTIFACT_STATUSES, cambios.estado, "BORRADOR");
    data.status = estado;
    if (estado === "PRESENTADO" && !artefacto.presentedAt) data.presentedAt = new Date();
  }
  if (Object.keys(data).length === 0) throw new AgentApiError("El cambio no trae ningun campo reconocido.", 400);

  const r = await prisma.artifact.update({
    where: { id },
    data,
    select: { id: true, title: true, kind: true, status: true, iteration: true },
  });
  return { id: r.id, titulo: r.title, formato: r.kind, estado: r.status, iteracion: r.iteration };
}

// ─────────────────────────────────────────────────────────────────────────────
// Documento del artefacto y prompt para producirlo
// ─────────────────────────────────────────────────────────────────────────────

/** Peso maximo del documento: Nginx acepta 8 MB por peticion. */
const MAX_DOCUMENTO = 7 * 1024 * 1024;

/**
 * Carga el HTML del artefacto por la API, con los mismos avisos que el script
 * `artefacto:cargar`: botones de ingreso y porcentajes no declarados.
 */
export async function uploadArtifactDocument(user: SessionUser, id: string, html: string) {
  const artefacto = await prisma.artifact.findUnique({
    where: { id },
    select: { id: true, projectId: true, title: true, cifras: { select: { value: true } } },
  });
  if (!artefacto) throw new AgentApiError("El artefacto no existe.", 404);
  const access = await getProjectRole(user, artefacto.projectId);
  if (!access) throw new AgentApiError("El artefacto no existe.", 404);
  if (!canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }
  const doc = typeof html === "string" ? html : "";
  if (!/<html[\s>]/i.test(doc) && !/<body[\s>]/i.test(doc)) {
    throw new AgentApiError("El documento tiene que ser un HTML completo.", 400);
  }
  const peso = Buffer.byteLength(doc, "utf8");
  if (peso > MAX_DOCUMENTO) {
    throw new AgentApiError(`El documento pesa ${(peso / 1048576).toFixed(1)} MB; el maximo es 7 MB.`, 413);
  }

  await prisma.artifact.update({ where: { id }, data: { html: doc } });

  const texto = doc
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const avisos: string[] = [];
  if (/\b(login|iniciar sesi[oó]n|entrar a la aplicaci[oó]n|ingresar)\b/i.test(texto)) {
    avisos.push("El documento tiene botones de ingreso o inicio de sesion: presenta el concepto como producto existente.");
  }
  const declaradas = new Set(artefacto.cifras.map((c) => c.value.replace(/\s/g, "")));
  const sueltas = [...new Set(texto.match(/[+-]?\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?\s*%/g) ?? [])]
    .map((c) => c.replace(/\s/g, ""))
    .filter((c) => !declaradas.has(c));
  if (sueltas.length > 0) {
    avisos.push(`Porcentajes no declarados como cifra: ${sueltas.slice(0, 8).join(", ")}.`);
  }
  return { id, titulo: artefacto.title, pesoKB: Math.round(peso / 1024), ...(avisos.length ? { avisos } : {}) };
}

/** El prompt especifico para producir un artefacto de este concepto. */
export async function promptForConcept(user: SessionUser, conceptId: string, formato: string) {
  const { construirPromptArtefacto, FORMATOS_PROMPT } = await import("@/lib/promptArtefacto");
  const { datosPromptArtefacto } = await import("@/lib/promptArtefactoDatos");
  const concepto = await prisma.concept.findUnique({ where: { id: conceptId }, select: { projectId: true } });
  if (!concepto) throw new AgentApiError("El concepto no existe.", 404);
  const access = await getProjectRole(user, concepto.projectId);
  if (!access) throw new AgentApiError("El concepto no existe.", 404);
  const f = (FORMATOS_PROMPT as readonly string[]).includes(formato) ? (formato as (typeof FORMATOS_PROMPT)[number]) : "BROCHURE";
  const datos = await datosPromptArtefacto(conceptId);
  if (!datos) throw new AgentApiError("El concepto no existe.", 404);
  return { formato: f, prompt: construirPromptArtefacto(datos, f) };
}
