"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser, requireAdmin, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit, canAdminProject } from "@/lib/enums";
import { getProjectRole, uniqueSlug } from "@/lib/projects";
import { startResearchRun } from "@/lib/agent/run";
import type { AgentScope } from "@/lib/agent/prompt";

// ─────────────────────────────────────────────────────────────────────────────
// Proyectos
// ─────────────────────────────────────────────────────────────────────────────

export async function createProject(formData: FormData): Promise<void> {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("El proyecto necesita un nombre.");

  const templateKey = String(formData.get("templateKey") ?? "gimi-5x5");
  const template = await prisma.mapTemplate.findUnique({ where: { key: templateKey } });
  if (!template) throw new Error("La plantilla seleccionada no existe.");

  const slug = await uniqueSlug(name);

  await prisma.project.create({
    data: {
      slug,
      name,
      company: String(formData.get("company") ?? "").trim() || null,
      program: String(formData.get("program") ?? "").trim() || null,
      createdById: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
      brief: {
        create: { challengeText: String(formData.get("challengeText") ?? "").trim() },
      },
      maps: { create: { templateId: template.id } },
    },
  });

  revalidatePath("/proyectos");
  redirect(`/proyectos/${slug}/brief`);
}

export async function updateBrief(slug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");

  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para editar este proyecto.");

  const list = (key: string): string =>
    JSON.stringify(
      String(formData.get(key) ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    );

  const data = {
    challengeText: String(formData.get("challengeText") ?? "").trim(),
    problema: String(formData.get("problema") ?? "").trim(),
    porQueMotivante: String(formData.get("porQueMotivante") ?? "").trim(),
    meta: String(formData.get("meta") ?? "").trim(),
    solutionFoci: JSON.stringify(formData.getAll("solutionFoci").map(String)),
    queHacer: list("queHacer"),
    queEvitar: list("queEvitar"),
    restricciones: String(formData.get("restricciones") ?? "").trim(),
    razonDeCambio: String(formData.get("razonDeCambio") ?? "").trim(),
    brechaCrecimiento: String(formData.get("brechaCrecimiento") ?? "").trim(),
    perfilInversion: String(formData.get("perfilInversion") ?? "").trim(),
    agentHints: String(formData.get("agentHints") ?? "").trim(),
    agentExclude: String(formData.get("agentExclude") ?? "").trim(),
  };

  await prisma.brief.upsert({
    where: { projectId: project.id },
    update: data,
    create: { projectId: project.id, ...data },
  });

  revalidatePath(`/proyectos/${slug}/brief`);
  revalidatePath(`/proyectos/${slug}`);
}

/** Renombrar el proyecto y sus datos de cabecera. El slug NO cambia: es la URL
 *  que el equipo ya tiene guardada y compartida. */
export async function updateProjectInfo(slug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");

  const access = await getProjectRole(user, project.id);
  if (!canAdminProject(access?.role)) {
    throw new Error("Solo el responsable puede cambiar los datos del proyecto.");
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("El proyecto necesita un nombre.");

  await prisma.project.update({
    where: { id: project.id },
    data: {
      name,
      company: String(formData.get("company") ?? "").trim() || null,
      program: String(formData.get("program") ?? "").trim() || null,
    },
  });

  revalidatePath(`/proyectos/${slug}`);
  revalidatePath("/proyectos");
}

/**
 * Manda el proyecto a la papelera. No borra nada: cambia su estado y guarda
 * cuando se tiro. Sale de la lista, pero se puede restaurar entero.
 */
export async function trashProject(slug: string): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");

  const access = await getProjectRole(user, project.id);
  if (!canAdminProject(access?.role)) {
    throw new Error("Solo el responsable puede enviar el proyecto a la papelera.");
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "TRASHED", trashedAt: new Date() },
  });

  revalidatePath("/proyectos");
  redirect("/proyectos");
}

export async function restoreProject(slug: string): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");

  const access = await getProjectRole(user, project.id);
  if (!canAdminProject(access?.role)) throw new Error("Sin permiso.");

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "ACTIVE", trashedAt: null },
  });

  revalidatePath("/proyectos");
  revalidatePath("/proyectos/papelera");
}

/**
 * Borrado real. Solo alcanza proyectos que YA estan en la papelera: es el
 * segundo acto deliberado que exige destruir el trabajo de meses. La cascada
 * se lleva mapa, fragmentos, historial, bibliografia y preguntas.
 */
export async function deleteProjectForever(slug: string): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");
  if (project.status !== "TRASHED") {
    throw new Error("Solo se pueden borrar proyectos que esten en la papelera.");
  }

  const access = await getProjectRole(user, project.id);
  if (!canAdminProject(access?.role)) throw new Error("Sin permiso.");

  await prisma.project.delete({ where: { id: project.id } });
  revalidatePath("/proyectos/papelera");
  revalidatePath("/proyectos");
}

// ─────────────────────────────────────────────────────────────────────────────
// Agente
// ─────────────────────────────────────────────────────────────────────────────

export async function launchAgent(slug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({
    where: { slug },
    include: { maps: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  if (!project || !project.maps[0]) throw new Error("El proyecto no tiene mapa.");

  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para correr el agente aqui.");

  const cells = formData
    .getAll("cells")
    .map(String)
    .filter(Boolean)
    .map((v) => {
      const [rowId, colId] = v.split("|");
      return { rowId, colId };
    });

  const scope: AgentScope = {
    cells,
    perCell: Math.min(Math.max(Number(formData.get("perCell") ?? 4), 1), 10),
    note: String(formData.get("note") ?? "").trim(),
  };

  await startResearchRun({
    projectId: project.id,
    mapId: project.maps[0].id,
    userId: user.id,
    scope,
  });

  revalidatePath(`/proyectos/${slug}/agente`);
}

/** Modelo de IA y busqueda web del proyecto. */
export async function updateAgentSettings(slug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");

  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) throw new Error("No tienes permiso para cambiar esto.");

  await prisma.project.update({
    where: { id: project.id },
    data: {
      agentModel: String(formData.get("agentModel") ?? "").trim(),
      agentWebSearch: formData.get("agentWebSearch") === "on",
    },
  });

  revalidatePath(`/proyectos/${slug}/agente`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Preguntas pendientes y bibliografia
// ─────────────────────────────────────────────────────────────────────────────

export async function addOpenQuestion(slug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");
  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) throw new Error("Sin permiso.");

  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  const ultima = await prisma.openQuestion.findFirst({
    where: { projectId: project.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.openQuestion.create({
    data: {
      projectId: project.id,
      text,
      askedTo: String(formData.get("askedTo") ?? "").trim(),
      origin: "HUMAN",
      position: (ultima?.position ?? -1) + 1,
    },
  });
  revalidatePath(`/proyectos/${slug}/fuentes`);
}

export async function updateOpenQuestion(
  slug: string,
  questionId: string,
  formData: FormData,
): Promise<void> {
  const { question } = await guardQuestion(slug, questionId);

  const text = String(formData.get("text") ?? "").trim();
  if (!text) throw new Error("La pregunta no puede quedar vacia.");

  const answer = String(formData.get("answer") ?? question.answer).trim();
  await prisma.openQuestion.update({
    where: { id: questionId },
    data: {
      text,
      askedTo: String(formData.get("askedTo") ?? question.askedTo).trim(),
      answer,
      status: String(formData.get("status") ?? (answer ? "ANSWERED" : "OPEN")),
    },
  });
  revalidatePath(`/proyectos/${slug}/fuentes`);
}

export async function deleteOpenQuestion(slug: string, questionId: string): Promise<void> {
  await guardQuestion(slug, questionId);
  await prisma.openQuestion.delete({ where: { id: questionId } });
  revalidatePath(`/proyectos/${slug}/fuentes`);
}

/**
 * Sube o baja una pregunta. Intercambia posiciones con la vecina en lugar de
 * renumerar todo: es una sola escritura y no depende de que las posiciones
 * sean consecutivas.
 */
export async function moveOpenQuestion(
  slug: string,
  questionId: string,
  direction: "UP" | "DOWN",
): Promise<void> {
  const { question, projectId } = await guardQuestion(slug, questionId);

  const hermanas = await prisma.openQuestion.findMany({
    where: { projectId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const i = hermanas.findIndex((q) => q.id === questionId);
  const j = direction === "UP" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= hermanas.length) return;

  // Las posiciones pueden venir todas en 0 de antes de esta funcion: se
  // normalizan por indice antes de intercambiar.
  await prisma.$transaction([
    ...hermanas.map((q, k) =>
      prisma.openQuestion.update({ where: { id: q.id }, data: { position: k } }),
    ),
    prisma.openQuestion.update({ where: { id: hermanas[i].id }, data: { position: j } }),
    prisma.openQuestion.update({ where: { id: hermanas[j].id }, data: { position: i } }),
  ]);

  void question;
  revalidatePath(`/proyectos/${slug}/fuentes`);
}

async function guardQuestion(slug: string, questionId: string) {
  const user = await requireUser();
  const question = await prisma.openQuestion.findUnique({ where: { id: questionId } });
  if (!question) throw new Error("La pregunta no existe.");

  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project || project.id !== question.projectId) throw new Error("La pregunta no existe.");

  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) throw new Error("Sin permiso.");

  return { question, projectId: project.id };
}

export async function addSource(slug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");
  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) throw new Error("Sin permiso.");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await prisma.source.create({
    data: {
      projectId: project.id,
      title,
      url: String(formData.get("url") ?? "").trim() || null,
      publisher: String(formData.get("publisher") ?? "").trim() || null,
      year: String(formData.get("year") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim(),
      addedBy: "HUMAN",
    },
  });
  revalidatePath(`/proyectos/${slug}/fuentes`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Miembros del proyecto y usuarios de la plataforma
// ─────────────────────────────────────────────────────────────────────────────

export async function addMember(slug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");
  const access = await getProjectRole(user, project.id);
  if (!canAdminProject(access?.role)) throw new Error("Solo el responsable puede invitar.");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) throw new Error(`No hay ningun usuario con el correo ${email}. Creelo primero en Administracion.`);

  await prisma.membership.upsert({
    where: { projectId_userId: { projectId: project.id, userId: target.id } },
    update: { role: String(formData.get("role") ?? "EDITOR") },
    create: {
      projectId: project.id,
      userId: target.id,
      role: String(formData.get("role") ?? "EDITOR"),
    },
  });
  revalidatePath(`/proyectos/${slug}/equipo`);
}

export async function removeMember(slug: string, userId: string): Promise<void> {
  const user = await requireUser();
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) throw new Error("El proyecto no existe.");
  const access = await getProjectRole(user, project.id);
  if (!canAdminProject(access?.role)) throw new Error("Solo el responsable puede quitar miembros.");

  await prisma.membership.deleteMany({ where: { projectId: project.id, userId } });
  revalidatePath(`/proyectos/${slug}/equipo`);
}

export async function createUser(formData: FormData): Promise<void> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !name || password.length < 8) {
    throw new Error("Correo, nombre y una contraseña de al menos 8 caracteres son obligatorios.");
  }

  await prisma.user.create({
    data: {
      email,
      name,
      role: String(formData.get("role") ?? "MEMBER"),
      passwordHash: await hashPassword(password),
    },
  });
  revalidatePath("/admin/usuarios");
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  if (admin.id === userId) throw new Error("No puedes desactivar tu propia cuenta.");

  await prisma.user.update({ where: { id: userId }, data: { active } });
  if (!active) await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/usuarios");
}

export async function resetUserPassword(userId: string, formData: FormData): Promise<void> {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  });
  // Cerrar sesiones abiertas: si se cambio la clave, las cookies viejas mueren.
  await prisma.session.deleteMany({ where: { userId } });
  revalidatePath("/admin/usuarios");
}
