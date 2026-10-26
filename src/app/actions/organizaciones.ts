"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit, canAdminProject } from "@/lib/enums";
import { getOrgRole, uniqueOrgSlug, leerJson } from "@/lib/organizaciones";
import { getProjectRole, uniqueSlug } from "@/lib/projects";
import { EJES_PERFIL } from "@/lib/gimi";
import type { Encaje } from "@/lib/encaje";

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────────

/** Vuelve a la página con un aviso legible (los errores lanzados se ocultan en producción). */
function volverCon(ruta: string, tipo: "hecho" | "error", mensaje: string): never {
  redirect(`${ruta}?${tipo}=${encodeURIComponent(mensaje)}`);
}

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const lineas = (fd: FormData, k: string) =>
  JSON.stringify(
    texto(fd, k)
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );
const entero = (fd: FormData, k: string, min: number, max: number) => {
  const n = Number(fd.get(k));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : 0;
};

async function orgEditable(slug: string) {
  const user = await requireUser();
  const org = await prisma.organizacion.findUnique({ where: { slug }, include: { perfil: true } });
  if (!org) throw new Error("La organización no existe.");
  const role = await getOrgRole(user, org.id);
  return { user, org, role, puedeEditar: canEdit(role), esResponsable: canAdminProject(role) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Organización y miembros
// ─────────────────────────────────────────────────────────────────────────────

export async function crearOrganizacion(formData: FormData): Promise<void> {
  const user = await requireUser();
  const name = texto(formData, "name");
  if (!name) volverCon("/organizaciones", "error", "La organización necesita un nombre.");

  const slug = await uniqueOrgSlug(name);
  await prisma.organizacion.create({
    data: {
      slug,
      name,
      sector: texto(formData, "sector"),
      descripcion: texto(formData, "descripcion"),
      createdById: user.id,
      miembros: { create: { userId: user.id, role: "OWNER" } },
      perfil: { create: {} },
    },
  });
  revalidatePath("/organizaciones");
  redirect(`/organizaciones/${slug}/perfil`);
}

export async function agregarMiembroOrg(slug: string, formData: FormData): Promise<void> {
  const { org, esResponsable } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/equipo`;
  if (!esResponsable) volverCon(ruta, "error", "Solo el responsable puede agregar personas.");

  const email = texto(formData, "email").toLowerCase();
  const persona = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!persona) {
    volverCon(ruta, "error", `No hay ninguna cuenta con el correo ${email || "(vacío)"}. Primero hay que crearla en Administración > Usuarios.`);
  }
  const role = ["OWNER", "EDITOR", "VIEWER"].includes(texto(formData, "role")) ? texto(formData, "role") : "EDITOR";
  await prisma.orgMembership.upsert({
    where: { organizacionId_userId: { organizacionId: org.id, userId: persona.id } },
    update: { role },
    create: { organizacionId: org.id, userId: persona.id, role },
  });
  revalidatePath(ruta);
  volverCon(ruta, "hecho", `${persona.name} ya es parte del equipo de ${org.name}.`);
}

export async function quitarMiembroOrg(slug: string, userId: string): Promise<void> {
  const { org, esResponsable } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/equipo`;
  if (!esResponsable) volverCon(ruta, "error", "Solo el responsable puede quitar personas.");
  await prisma.orgMembership.deleteMany({ where: { organizacionId: org.id, userId, role: { not: "OWNER" } } });
  revalidatePath(ruta);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 1 · Intención de innovar
// ─────────────────────────────────────────────────────────────────────────────

const posicion = (formData: FormData, campo: string) => {
  const v = texto(formData, campo);
  return ["IMITADOR", "TRANSFORMADOR", "PIONERO"].includes(v) ? v : "";
};

export async function guardarPerfil(slug: string, formData: FormData): Promise<void> {
  const { org, puedeEditar } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/perfil`;
  if (!puedeEditar) volverCon(ruta, "error", "No tienes permiso para editar la intención de innovar.");

  const ejes = Object.fromEntries(EJES_PERFIL.map((e) => [e.campo, entero(formData, e.campo, 0, 5)]));
  const datos = {
    definicion: texto(formData, "definicion"),
    tiposInnovacion: JSON.stringify(formData.getAll("tiposInnovacion").map(String)),
    dondeInnovar: texto(formData, "dondeInnovar"),
    // Los límites quedan en un solo campo (restricciones); lo viejo se vacía aquí
    // porque la página ya lo ofreció unido a los límites.
    queNoEsInnovar: "",
    razonesCambio: JSON.stringify(formData.getAll("razonesCambio").map(String)),
    argumentoCambio: texto(formData, "argumentoCambio"),
    brechaCuanto: texto(formData, "brechaCuanto"),
    brechaCuando: texto(formData, "brechaCuando"),
    objetivos: lineas(formData, "objetivos"),
    metricas: lineas(formData, "metricas"),
    ...ejes,
    presupuesto: texto(formData, "presupuesto"),
    perfilOtro: texto(formData, "perfilOtro"),
    posicionActual: posicion(formData, "posicionActual"),
    posicionDeseada: posicion(formData, "posicionDeseada"),
    restricciones: lineas(formData, "restricciones"),
  };
  await prisma.perfilInnovacion.upsert({
    where: { organizacionId: org.id },
    update: datos,
    create: { organizacionId: org.id, ...datos },
  });
  await prisma.organizacion.update({ where: { id: org.id }, data: { updatedAt: new Date() } });
  revalidatePath(`/organizaciones/${slug}`, "layout");
  volverCon(`/organizaciones/${slug}/desafios`, "hecho", "Intención de innovar guardada.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 2 · Proponer desafíos (2.1.1) y su encaje
// ─────────────────────────────────────────────────────────────────────────────

export async function proponerDesafio(slug: string, formData: FormData): Promise<void> {
  const { user, org, puedeEditar } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/desafios`;
  if (!puedeEditar) volverCon(ruta, "error", "No tienes permiso para proponer desafíos.");

  const titulo = texto(formData, "titulo");
  const problema = texto(formData, "problema");
  if (!titulo || !problema) volverCon(ruta, "error", "El desafío necesita un título y la descripción del problema.");

  await prisma.desafioPropuesto.create({
    data: {
      organizacionId: org.id,
      autorId: user.id,
      titulo,
      problema,
      porQueRelevante: texto(formData, "porQueRelevante"),
      impacto: texto(formData, "impacto"),
      origen: texto(formData, "origen") === "ORGANIZACION" ? "ORGANIZACION" : "EQUIPO",
      trabajandoEn: entero(formData, "trabajandoEn", 0, 3),
      emocionante: entero(formData, "emocionante", 0, 3),
      nivelImpacto: entero(formData, "nivelImpacto", 0, 3),
    },
  });
  revalidatePath(ruta);
  volverCon(ruta, "hecho", `Desafío «${titulo}» propuesto.`);
}

/**
 * Atajo para cuando el reto lo entrega la organización o el sponsor, como en
 * Caribe Innova (la ficha del reto llega como parte del Paso 1). No hay nada que
 * proponer ni votar: el desafío queda seleccionado y se pasa a diseñarlo.
 */
export async function retoDelSponsor(slug: string, formData: FormData): Promise<void> {
  const { user, org, puedeEditar } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/desafios`;
  if (!puedeEditar) volverCon(ruta, "error", "No tienes permiso para registrar el reto.");
  const titulo = texto(formData, "titulo");
  const problema = texto(formData, "problema");
  if (!titulo || !problema) volverCon(ruta, "error", "El reto necesita un título y su enunciado.");
  const d = await prisma.desafioPropuesto.create({
    data: { organizacionId: org.id, autorId: user.id, titulo, problema, origen: "ORGANIZACION", estado: "SELECCIONADO" },
  });
  revalidatePath(`/organizaciones/${slug}`, "layout");
  redirect(`/organizaciones/${slug}/reto?desafio=${d.id}`);
}

export async function evaluarEncaje(slug: string, desafioId: string, formData: FormData): Promise<void> {
  const { org, puedeEditar } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/desafios`;
  if (!puedeEditar) volverCon(ruta, "error", "No tienes permiso para evaluar el encaje.");

  const restriccionesOrg = leerJson<string[]>(org.perfil?.restricciones, []);
  const sino = (k: string): boolean | null => (texto(formData, k) === "si" ? true : texto(formData, k) === "no" ? false : null);
  const encaje: Encaje = {
    tipos: formData.getAll("tipos").map(String),
    restricciones: Object.fromEntries(
      restriccionesOrg.flatMap((r, i) => {
        const v = sino(`restriccion_${i}`);
        return v === null ? [] : [[r, v]];
      }),
    ),
    brecha: sino("brecha"),
    perfil: sino("perfil"),
    veredicto: (["ENCAJA", "PARCIAL", "NO_ENCAJA"] as const).find((v) => v === texto(formData, "veredicto")) ?? "",
    nota: texto(formData, "nota"),
  };
  await prisma.desafioPropuesto.update({
    where: { id: desafioId, organizacionId: org.id },
    data: { encaje: JSON.stringify(encaje) },
  });
  revalidatePath(ruta);
  volverCon(ruta, "hecho", "Encaje guardado.");
}

export async function eliminarDesafio(slug: string, desafioId: string): Promise<void> {
  const { user, org, esResponsable } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/desafios`;
  const d = await prisma.desafioPropuesto.findFirst({ where: { id: desafioId, organizacionId: org.id } });
  if (!d) volverCon(ruta, "error", "Ese desafío ya no existe.");
  if (d.projectId) volverCon(ruta, "error", "Ese desafío ya se convirtió en reto; no se puede borrar.");
  if (d.autorId !== user.id && !esResponsable) volverCon(ruta, "error", "Solo quien lo propuso o el responsable pueden borrarlo.");
  await prisma.desafioPropuesto.delete({ where: { id: d.id } });
  revalidatePath(ruta);
  volverCon(ruta, "hecho", `Desafío «${d.titulo}» borrado.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 3 · Seleccionar (2.1.2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ejercicio 2.1.2 (CG.pdf): «los miembros del equipo votan y seleccionan el
 * desafío de mayor impacto». Un voto por persona: votar por uno retira el voto
 * que la persona tuviera en otro, y votar otra vez por el mismo lo retira.
 */
export async function votarDesafio(slug: string, desafioId: string): Promise<void> {
  const { user, org, puedeEditar } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/seleccion`;
  if (!puedeEditar) volverCon(ruta, "error", "Los lectores no votan.");

  const d = await prisma.desafioPropuesto.findFirst({ where: { id: desafioId, organizacionId: org.id } });
  if (!d) volverCon(ruta, "error", "Ese desafío ya no existe.");

  const yaEra = await prisma.votoDesafio.findUnique({ where: { desafioId_userId: { desafioId, userId: user.id } } });
  await prisma.votoDesafio.deleteMany({ where: { userId: user.id, desafio: { organizacionId: org.id } } });
  if (!yaEra) await prisma.votoDesafio.create({ data: { desafioId, userId: user.id, puntos: 1 } });
  revalidatePath(ruta);
}

export async function cambiarEstadoDesafio(slug: string, desafioId: string, estado: string): Promise<void> {
  const { org, esResponsable } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/seleccion`;
  if (!esResponsable) volverCon(ruta, "error", "Solo el responsable confirma la selección del equipo.");
  if (!["PROPUESTO", "SELECCIONADO", "DESCARTADO"].includes(estado)) volverCon(ruta, "error", "Estado no válido.");

  const d = await prisma.desafioPropuesto.update({
    where: { id: desafioId, organizacionId: org.id },
    data: { estado },
  });
  revalidatePath(`/organizaciones/${slug}`, "layout");
  if (estado === "SELECCIONADO") redirect(`/organizaciones/${slug}/reto?desafio=${d.id}`);
  volverCon(ruta, "hecho", estado === "DESCARTADO" ? `«${d.titulo}» queda descartado.` : `«${d.titulo}» vuelve a estar en votación.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 4 · Diseñar el reto (2.1.3) → nace el proyecto
// ─────────────────────────────────────────────────────────────────────────────

function datosReto(formData: FormData) {
  return {
    challengeText: texto(formData, "challengeText"),
    problema: texto(formData, "problema"),
    porQueMotivante: texto(formData, "porQueMotivante"),
    meta: texto(formData, "meta"),
    solutionFoci: JSON.stringify(formData.getAll("solutionFoci").map(String)),
    queHacer: lineas(formData, "queHacer"),
    queEvitar: lineas(formData, "queEvitar"),
    restricciones: texto(formData, "restricciones"),
  };
}

export async function crearReto(slug: string, desafioId: string, formData: FormData): Promise<void> {
  const { user, org, esResponsable } = await orgEditable(slug);
  const ruta = `/organizaciones/${slug}/reto`;
  if (!esResponsable) volverCon(ruta, "error", "Solo el responsable crea el reto.");

  const d = await prisma.desafioPropuesto.findFirst({ where: { id: desafioId, organizacionId: org.id } });
  if (!d) volverCon(ruta, "error", "Ese desafío ya no existe.");
  if (d.projectId) volverCon(ruta, "error", "Ese desafío ya tiene su reto.");

  const name = texto(formData, "name") || d.titulo;
  const brief = datosReto(formData);
  if (!brief.problema || !brief.meta) {
    volverCon(`${ruta}?desafio=${d.id}`, "error", "El reto necesita al menos el problema y la meta (brecha a cerrar y para cuándo).");
  }

  const template = await prisma.mapTemplate.findUnique({ where: { key: "gimi-5x5" } });
  const miembros = await prisma.orgMembership.findMany({ where: { organizacionId: org.id } });
  const projectSlug = await uniqueSlug(name);

  const project = await prisma.project.create({
    data: {
      slug: projectSlug,
      name,
      company: org.name,
      program: texto(formData, "program") || null,
      createdById: user.id,
      organizacionId: org.id,
      members: {
        create: [
          { userId: user.id, role: "OWNER" },
          ...miembros.filter((m) => m.userId !== user.id).map((m) => ({ userId: m.userId, role: m.role })),
        ],
      },
      brief: { create: brief },
      ...(template ? { maps: { create: { templateId: template.id } } } : {}),
    },
  });
  await prisma.desafioPropuesto.update({ where: { id: d.id }, data: { projectId: project.id, estado: "SELECCIONADO" } });

  revalidatePath(`/organizaciones/${slug}`, "layout");
  revalidatePath("/proyectos");
  redirect(`/proyectos/${projectSlug}?hecho=${encodeURIComponent("Reto creado.")}`);
}

export async function actualizarReto(projectSlug: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const ruta = `/proyectos/${projectSlug}/configurar`;
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) volverCon("/proyectos", "error", "El proyecto no existe.");
  const access = await getProjectRole(user, project.id);
  if (!canEdit(access?.role)) volverCon(ruta, "error", "No tienes permiso para editar el reto.");

  const brief = datosReto(formData);
  await prisma.brief.upsert({ where: { projectId: project.id }, update: brief, create: { projectId: project.id, ...brief } });
  revalidatePath(ruta);
  volverCon(ruta, "hecho", "Reto guardado.");
}
