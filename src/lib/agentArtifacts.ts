import "server-only";

import { prisma } from "@/lib/db";
import { asEnum, canEdit, ARTIFACT_KINDS, CLAIM_KINDS } from "@/lib/enums";
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
    siguiente: `Cargar el documento en el servidor: npm run artefacto:cargar -- ${creado.id} archivo.html`,
  };
}
