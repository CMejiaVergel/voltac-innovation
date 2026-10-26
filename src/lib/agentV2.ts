import "server-only";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { AgentApiError } from "@/lib/agentApi";
import { canEdit, asEnum, VERIFICATIONS, ARTIFACT_KINDS } from "@/lib/enums";
import { getProjectRole, getPrimaryMap } from "@/lib/projects";
import { getOrgRole, listOrgsFor, uniqueOrgSlug, leerJson } from "@/lib/organizaciones";
import { EJES_PERFIL, IDEX, LINEA_CONCEPTO, PREGUNTA_LIENZO, TIPOS_INNOVACION, frasesIntencion, tiposVigentes } from "@/lib/gimi";
import { CAMPOS_BROCHURE, CAMPOS_CASO, avanceLinea, leerActuar } from "@/lib/actuar";
import { tituloPostit } from "@/lib/v2";

/**
 * Canal no-code de la v2: lo que Claude puede hacer en la plataforma, vía MCP,
 * cuando una persona se lo pide. Opera con los permisos del dueño del token y
 * deja nota «vía Claude» en el historial.
 *
 * Quedan fuera a propósito las DECISIONES del equipo —votar y seleccionar el
 * desafío, puntuar conceptos y decidir cuál sigue adelante—: esas se toman en
 * la interfaz, entre personas.
 */

type P = Record<string, unknown>;
const txt = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const opt = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const NOTA = "vía Claude (MCP)";

async function proyecto(user: SessionUser, slug: unknown, escribir: boolean) {
  const project = await prisma.project.findUnique({ where: { slug: txt(slug, 200) }, include: { brief: true } });
  if (!project) throw new AgentApiError(`No existe el proyecto "${String(slug)}".`, 404);
  const acceso = await getProjectRole(user, project.id);
  if (!acceso) throw new AgentApiError(`No existe el proyecto "${String(slug)}".`, 404);
  if (escribir && !canEdit(acceso.role)) throw new AgentApiError("No tienes permiso de edición en este proyecto.", 403);
  const primary = await getPrimaryMap(project.id);
  if (!primary) throw new AgentApiError("El proyecto no tiene mapa.", 409);
  return { project, ...primary };
}

async function organizacion(user: SessionUser, slug: unknown, escribir: boolean) {
  const org = await prisma.organizacion.findUnique({ where: { slug: txt(slug, 200) }, include: { perfil: true } });
  if (!org) throw new AgentApiError(`No existe la organización "${String(slug)}".`, 404);
  const rol = await getOrgRole(user, org.id);
  if (!rol) throw new AgentApiError(`No existe la organización "${String(slug)}".`, 404);
  if (escribir && !canEdit(rol)) throw new AgentApiError("No tienes permiso de edición en esta organización.", 403);
  return org;
}

async function conceptoEditable(user: SessionUser, id: unknown) {
  const c = await prisma.concept.findUnique({ where: { id: txt(id, 60) }, include: { project: { select: { id: true, slug: true } } } });
  if (!c) throw new AgentApiError("Ese concepto no existe.", 404);
  const acceso = await getProjectRole(user, c.project.id);
  if (!acceso || !canEdit(acceso.role)) throw new AgentApiError("No tienes permiso de edición en este proyecto.", 403);
  return c;
}

function refrescar(slug: string) {
  for (const r of ["", "/divergir", "/combinar", "/convergir", "/actuar"]) revalidatePath(`/proyectos/${slug}${r}`);
}

/** Acepta el id o el nombre de una fila/columna de la plantilla («Mercado», «mercado»). */
function coord(shape: { rows: { id: string; name: string }[]; cols: { id: string; name: string }[] }, dim: unknown, lente: unknown) {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const fila = shape.rows.find((r) => norm(r.id) === norm(String(dim ?? "")) || norm(r.name) === norm(String(dim ?? "")));
  const col = shape.cols.find((c) => norm(c.id) === norm(String(lente ?? "")) || norm(c.name) === norm(String(lente ?? "")));
  if (!fila) throw new AgentApiError(`Dimensión desconocida: "${String(dim)}". Usa una de: ${shape.rows.map((r) => r.id).join(", ")}.`, 400);
  if (!col) throw new AgentApiError(`Lente desconocido: "${String(lente)}". Usa uno de: ${shape.cols.map((c) => c.id).join(", ")}.`, 400);
  return { rowId: fila.id, colId: col.id };
}

// ─── Organizaciones ──────────────────────────────────────────────────────────

const ACCIONES: Record<string, (u: SessionUser, p: P) => Promise<unknown>> = {
  async listar_organizaciones(u) {
    const orgs = await listOrgsFor(u);
    return orgs.map((o) => ({
      slug: o.slug,
      nombre: o.name,
      sector: o.sector,
      intencionDefinida: Boolean(o.perfil?.definicion),
      desafios: o._count.desafios,
      retos: o._count.proyectos,
    }));
  },

  async ver_organizacion(u, p) {
    const org = await organizacion(u, p.org, false);
    const [desafios, retos] = await Promise.all([
      prisma.desafioPropuesto.findMany({ where: { organizacionId: org.id }, include: { votos: true }, orderBy: { createdAt: "asc" } }),
      prisma.project.findMany({ where: { organizacionId: org.id }, select: { slug: true, name: true } }),
    ]);
    const pf = org.perfil;
    return {
      slug: org.slug,
      nombre: org.name,
      sector: org.sector,
      descripcion: org.descripcion,
      intencion: pf && {
        definicion: pf.definicion,
        resumen: frasesIntencion(pf),
        tiposInnovacion: tiposVigentes(leerJson<string[]>(pf.tiposInnovacion, [])),
        dondeInnovar: pf.dondeInnovar,
        razonesCambio: leerJson<string[]>(pf.razonesCambio, []),
        argumentoCambio: pf.argumentoCambio,
        brechaCuanto: pf.brechaCuanto,
        brechaCuando: pf.brechaCuando,
        objetivos: leerJson<string[]>(pf.objetivos, []),
        metricas: leerJson<string[]>(pf.metricas, []),
        posicionActual: pf.posicionActual,
        posicionDeseada: pf.posicionDeseada,
        ejes: Object.fromEntries(EJES_PERFIL.map((e) => [e.campo, pf[e.campo]])),
        perfilOtro: pf.perfilOtro,
        presupuesto: pf.presupuesto,
        restricciones: leerJson<string[]>(pf.restricciones, []),
      },
      desafios: desafios.map((d) => ({
        titulo: d.titulo,
        problema: d.problema,
        estado: d.estado,
        votos: d.votos.length,
        esReto: Boolean(d.projectId),
      })),
      retos,
    };
  },

  async crear_organizacion(u, p) {
    const nombre = txt(p.nombre, 160);
    if (!nombre) throw new AgentApiError("La organización necesita un nombre.", 400);
    const slug = await uniqueOrgSlug(nombre);
    await prisma.organizacion.create({
      data: {
        slug,
        name: nombre,
        sector: txt(p.sector, 160),
        descripcion: txt(p.descripcion, 1000),
        createdById: u.id,
        miembros: { create: { userId: u.id, role: "OWNER" } },
        perfil: { create: {} },
      },
    });
    revalidatePath("/organizaciones");
    return { slug, url: `/organizaciones/${slug}` };
  },

  /** Escribe solo los campos que vengan; lo demás queda como estaba. */
  async escribir_intencion(u, p) {
    const org = await organizacion(u, p.org, true);
    const data: Record<string, unknown> = {};
    for (const k of ["definicion", "dondeInnovar", "argumentoCambio", "brechaCuanto", "brechaCuando", "presupuesto", "perfilOtro"]) {
      const v = opt(p[k]);
      if (v !== undefined) data[k] = v;
    }
    for (const k of ["posicionActual", "posicionDeseada"]) {
      const v = opt(p[k], 20);
      if (v !== undefined) data[k] = ["IMITADOR", "TRANSFORMADOR", "PIONERO"].includes(v) ? v : "";
    }
    if (Array.isArray(p.tiposInnovacion)) {
      data.tiposInnovacion = JSON.stringify((p.tiposInnovacion as unknown[]).map((x) => txt(x, 30)).filter((k) => TIPOS_INNOVACION.some((t) => t.key === k)));
    }
    if (Array.isArray(p.razonesCambio)) {
      data.razonesCambio = JSON.stringify((p.razonesCambio as unknown[]).map((x) => txt(x, 30)).filter((k) => ["CEO", "ENTORNO", "COMPETENCIA", "CLIENTES", "OTRO"].includes(k)));
    }
    for (const k of ["objetivos", "metricas", "restricciones"]) {
      if (Array.isArray(p[k])) data[k] = JSON.stringify((p[k] as unknown[]).map((x) => txt(x, 400)).filter(Boolean));
    }
    for (const { campo: k } of EJES_PERFIL) {
      if (typeof p[k] === "number") data[k] = Math.min(5, Math.max(0, Math.round(p[k] as number)));
    }
    if (!Object.keys(data).length) throw new AgentApiError("No vino ningún campo para escribir.", 400);
    await prisma.perfilInnovacion.upsert({ where: { organizacionId: org.id }, update: data, create: { organizacionId: org.id, ...data } });
    revalidatePath(`/organizaciones/${org.slug}`, "layout");
    return { ok: true, campos: Object.keys(data) };
  },

  async proponer_desafio(u, p) {
    const org = await organizacion(u, p.org, true);
    const titulo = txt(p.titulo, 160);
    const problema = txt(p.problema);
    if (!titulo || !problema) throw new AgentApiError("El desafío necesita título y problema.", 400);
    const d = await prisma.desafioPropuesto.create({
      data: {
        organizacionId: org.id,
        autorId: u.id,
        titulo,
        problema,
        porQueRelevante: txt(p.porQueRelevante),
        impacto: txt(p.impacto),
        origen: p.entregadoPorLaOrganizacion ? "ORGANIZACION" : "EQUIPO",
      },
    });
    revalidatePath(`/organizaciones/${org.slug}/desafios`);
    return { id: d.id, aviso: "Queda propuesto. La votación y la selección las hace el equipo en la plataforma." };
  },

  // ─── Proyecto: embudo y mapa ───────────────────────────────────────────────

  async ver_embudo(u, p) {
    const { project, map } = await proyecto(u, p.slug, false);
    const [postits, conceptos] = await Promise.all([
      prisma.fragment.count({ where: { mapId: map.id, reviewState: "ACCEPTED", hidden: false } }),
      prisma.concept.findMany({
        where: { projectId: project.id, reviewState: "ACCEPTED", hidden: false },
        orderBy: { position: "asc" },
        include: { artefactos: { select: { status: true } }, supuestos: { select: { critical: true, failFastTest: true } }, _count: { select: { anclas: true } } },
      }),
    ]);
    return {
      proyecto: project.name,
      reto: project.brief?.challengeText ?? "",
      meta: project.brief?.meta ?? "",
      etapas: IDEX.map((e) => e.name),
      postits,
      conceptos: conceptos.map((c) => {
        const av = avanceLinea(c);
        return {
          id: c.id,
          nombre: c.title,
          postits: c._count.anclas,
          sigueAdelante: c.priorizado,
          linea: LINEA_CONCEPTO.map((x) => ({ paso: x.nombre, hecho: av[x.key] })),
        };
      }),
    };
  },

  async ver_mapa(u, p) {
    const { map, shape } = await proyecto(u, p.slug, false);
    const filtro: Record<string, string> = {};
    if (p.dimension || p.lente) {
      if (p.dimension) filtro.rowId = coord(shape, p.dimension, shape.cols[0].id).rowId;
      if (p.lente) filtro.colId = coord(shape, shape.rows[0].id, p.lente).colId;
    }
    const fs = await prisma.fragment.findMany({
      where: { mapId: map.id, reviewState: "ACCEPTED", hidden: false, ...filtro },
      orderBy: [{ rowId: "asc" }, { colId: "asc" }, { position: "asc" }],
      select: { id: true, rowId: true, colId: true, titulo: true, text: true, verification: true },
    });
    return {
      dimensiones: shape.rows.map((r) => ({ id: r.id, nombre: r.name, pregunta: PREGUNTA_LIENZO[r.id] ?? r.facets })),
      lentes: shape.cols.map((c) => ({ id: c.id, nombre: c.name, pregunta: c.question })),
      postits: fs.map((f) => ({
        id: f.id,
        dimension: f.rowId,
        lente: f.colId,
        titulo: f.titulo || null,
        tituloVisible: tituloPostit(f),
        texto: p.conTexto === false ? undefined : f.text,
        verificacion: f.verification,
      })),
    };
  },

  async pegar_postits(u, p) {
    const { project, map, shape } = await proyecto(u, p.slug, true);
    const lista = Array.isArray(p.postits) ? (p.postits as P[]) : [];
    if (!lista.length) throw new AgentApiError("Envía al menos un post-it.", 400);
    if (lista.length > 60) throw new AgentApiError("Máximo 60 post-its por llamada.", 400);
    const creados: string[] = [];
    for (const x of lista) {
      const { rowId, colId } = coord(shape, x.dimension, x.lente);
      const texto = txt(x.texto);
      if (!texto) throw new AgentApiError("Cada post-it necesita texto.", 400);
      const ultimo = await prisma.fragment.findFirst({ where: { mapId: map.id, rowId, colId }, orderBy: { position: "desc" }, select: { position: true } });
      const verification = asEnum(VERIFICATIONS, txt(x.verificacion, 20), "TO_CONFIRM");
      const f = await prisma.fragment.create({
        data: {
          mapId: map.id, rowId, colId, text: texto, titulo: txt(x.titulo, 80),
          position: (ultimo?.position ?? -1) + 1, verification, reviewState: "ACCEPTED", origin: "AGENT",
          authorId: u.id, sourceUrl: opt(x.fuenteUrl, 1000) || null, sourceCitation: opt(x.fuente, 500) || null,
        },
      });
      await prisma.fragmentRevision.create({
        data: { mapId: map.id, fragmentId: f.id, action: "CREATE", text: texto, rowId, colId, verification, reviewState: "ACCEPTED", note: NOTA, editedById: u.id },
      });
      creados.push(f.id);
    }
    refrescar(project.slug);
    return { creados: creados.length, ids: creados };
  },

  async editar_postit(u, p) {
    const f = await prisma.fragment.findUnique({ where: { id: txt(p.id, 60) }, include: { map: { include: { project: { select: { slug: true } } } } } });
    if (!f) throw new AgentApiError("Ese post-it no existe.", 404);
    const { shape } = await proyecto(u, f.map.project.slug, true);
    const data: Record<string, unknown> = {};
    if (opt(p.titulo, 80) !== undefined) data.titulo = txt(p.titulo, 80);
    if (opt(p.texto)) data.text = txt(p.texto);
    if (p.verificacion) data.verification = asEnum(VERIFICATIONS, txt(p.verificacion, 20), "TO_CONFIRM");
    if (typeof p.oculto === "boolean") data.hidden = p.oculto;
    if (p.dimension || p.lente) Object.assign(data, coord(shape, p.dimension ?? f.rowId, p.lente ?? f.colId));
    if (!Object.keys(data).length) throw new AgentApiError("No vino ningún cambio.", 400);
    await prisma.fragment.update({ where: { id: f.id }, data });
    await prisma.fragmentRevision.create({
      data: { mapId: f.mapId, fragmentId: f.id, action: "EDIT", text: (data.text as string) ?? null, note: NOTA, editedById: u.id },
    });
    refrescar(f.map.project.slug);
    return { ok: true };
  },

  async titular_postits(u, p) {
    const { project, map } = await proyecto(u, p.slug, true);
    const lista = Array.isArray(p.titulos) ? (p.titulos as P[]) : [];
    let hechos = 0;
    for (const x of lista.slice(0, 200)) {
      const titulo = txt(x.titulo, 80);
      if (!titulo) continue;
      const r = await prisma.fragment.updateMany({ where: { id: txt(x.id, 60), mapId: map.id }, data: { titulo } });
      if (r.count) {
        await prisma.fragmentRevision.create({ data: { mapId: map.id, fragmentId: txt(x.id, 60), action: "EDIT", note: `Título: ${titulo} · ${NOTA}`, editedById: u.id } });
        hechos++;
      }
    }
    refrescar(project.slug);
    return { titulados: hechos };
  },

  // ─── Combinar ──────────────────────────────────────────────────────────────

  async armar_concepto(u, p) {
    const { project, map } = await proyecto(u, p.slug, true);
    const nombre = txt(p.nombre, 120);
    if (!nombre) throw new AgentApiError("El concepto necesita un nombre.", 400);
    const ids = Array.isArray(p.postits) ? (p.postits as unknown[]).map((x) => txt(x, 60)) : [];
    const frags = await prisma.fragment.findMany({ where: { id: { in: ids }, mapId: map.id }, select: { id: true, rowId: true, text: true } });
    const ultimo = await prisma.concept.findFirst({ where: { projectId: project.id }, orderBy: { position: "desc" }, select: { position: true } });
    const c = await prisma.concept.create({
      data: {
        projectId: project.id, authorId: u.id, origin: "AGENT", title: nombre, statement: txt(p.frase),
        position: (ultimo?.position ?? -1) + 1,
        anclas: { create: frags.map((f, i) => ({ fragmentId: f.id, rowId: f.rowId, textSnapshot: f.text, position: i })) },
      },
    });
    refrescar(project.slug);
    return { id: c.id, postitsAnclados: frags.length, noEncontrados: ids.length - frags.length };
  },

  async ajustar_concepto(u, p) {
    const c = await conceptoEditable(u, p.id);
    const data: Record<string, unknown> = {};
    if (opt(p.nombre, 120)) data.title = txt(p.nombre, 120);
    if (opt(p.frase) !== undefined) data.statement = txt(p.frase);
    if (Object.keys(data).length) await prisma.concept.update({ where: { id: c.id }, data });
    const agregar = Array.isArray(p.agregar) ? (p.agregar as unknown[]).map((x) => txt(x, 60)) : [];
    const quitar = Array.isArray(p.quitar) ? (p.quitar as unknown[]).map((x) => txt(x, 60)) : [];
    if (quitar.length) await prisma.conceptFragment.deleteMany({ where: { conceptId: c.id, fragmentId: { in: quitar } } });
    if (agregar.length) {
      const frags = await prisma.fragment.findMany({ where: { id: { in: agregar }, map: { projectId: c.project.id } }, select: { id: true, rowId: true, text: true } });
      for (const f of frags) {
        await prisma.conceptFragment.upsert({
          where: { conceptId_fragmentId: { conceptId: c.id, fragmentId: f.id } },
          create: { conceptId: c.id, fragmentId: f.id, rowId: f.rowId, textSnapshot: f.text },
          update: {},
        });
      }
    }
    refrescar(c.project.slug);
    return { ok: true };
  },

  async ver_concepto(u, p) {
    const c = await prisma.concept.findUnique({
      where: { id: txt(p.id, 60) },
      include: {
        project: { select: { id: true } },
        anclas: { include: { fragment: { select: { id: true, titulo: true, text: true } } } },
        artefactos: true,
        supuestos: { orderBy: { position: "asc" } },
      },
    });
    if (!c || !(await getProjectRole(u, c.project.id))) throw new AgentApiError("Ese concepto no existe.", 404);
    const d = leerActuar(c.actuar);
    return {
      id: c.id,
      nombre: c.title,
      frase: c.statement,
      sigueAdelante: c.priorizado,
      postits: c.anclas.map((a) => ({ id: a.fragmentId, dimension: a.rowId, titulo: a.fragment ? tituloPostit(a.fragment) : null, texto: a.fragment?.text ?? a.textSnapshot })),
      brochure: d.brochure,
      artefactos: c.artefactos.map((a) => ({ id: a.id, nombre: a.title, tipo: a.kind, promesa: a.promise, estado: a.status, iteracion: a.iteration })),
      supuestos: c.supuestos.map((s) => ({ id: s.id, texto: s.text, probabilidad: s.likelihood, critico: s.critical, prueba: s.failFastTest, estado: s.status })),
      propuestaValor: c.propuestaValor,
      caso: d.caso,
    };
  },

  // ─── Actuar ────────────────────────────────────────────────────────────────

  async escribir_linea(u, p) {
    const c = await conceptoEditable(u, p.id);
    const actual = leerActuar(c.actuar);
    const mezclar = (base: Record<string, string | undefined>, nuevos: unknown, campos: readonly { campo: string }[]) => {
      if (!nuevos || typeof nuevos !== "object") return base;
      const out = { ...base };
      for (const { campo } of campos) {
        const v = opt((nuevos as P)[campo]);
        if (v !== undefined) out[campo] = v;
      }
      return out;
    };
    const actuar = {
      brochure: mezclar(actual.brochure, p.brochure, CAMPOS_BROCHURE),
      caso: mezclar(actual.caso, p.caso, CAMPOS_CASO),
    };
    const data: Record<string, unknown> = { actuar: JSON.stringify(actuar) };
    if (opt(p.propuestaValor) !== undefined) data.propuestaValor = txt(p.propuestaValor);
    await prisma.concept.update({ where: { id: c.id }, data });
    refrescar(c.project.slug);
    return { ok: true };
  },

  async agregar_artefacto(u, p) {
    const c = await conceptoEditable(u, p.id);
    const nombre = txt(p.nombre, 160);
    if (!nombre) throw new AgentApiError("El artefacto necesita un nombre.", 400);
    const a = await prisma.artifact.create({
      data: { projectId: c.project.id, conceptId: c.id, title: nombre, kind: asEnum(ARTIFACT_KINDS, txt(p.tipo, 30), "PROTOCEPTO"), promise: txt(p.promesa, 600), origin: "AGENT" },
    });
    refrescar(c.project.slug);
    return { id: a.id };
  },

  async agregar_supuestos(u, p) {
    const c = await conceptoEditable(u, p.id);
    const lista = Array.isArray(p.supuestos) ? (p.supuestos as P[]) : [];
    const ultimo = await prisma.assumption.findFirst({ where: { conceptId: c.id }, orderBy: { position: "desc" }, select: { position: true } });
    let pos = (ultimo?.position ?? -1) + 1;
    for (const s of lista.slice(0, 20)) {
      const texto = txt(s.texto, 600);
      if (!texto) continue;
      await prisma.assumption.create({
        data: {
          conceptId: c.id, text: texto, position: pos++,
          likelihood: typeof s.probabilidad === "number" ? Math.min(5, Math.max(1, Math.round(s.probabilidad))) : 3,
          failFastTest: txt(s.prueba, 1000),
        },
      });
    }
    refrescar(c.project.slug);
    return { ok: true, aviso: "Cuáles son las 3 menos probables lo marca el equipo en la plataforma." };
  },
};

export const ACCIONES_V2 = Object.keys(ACCIONES);

/** Las que solo leen: un token de solo lectura puede usarlas. */
export const LECTURAS_V2 = new Set(["listar_organizaciones", "ver_organizacion", "ver_embudo", "ver_mapa", "ver_concepto"]);

export async function ejecutarV2(user: SessionUser, accion: string, params: P): Promise<unknown> {
  const fn = ACCIONES[accion];
  if (!fn) throw new AgentApiError(`Acción desconocida: "${accion}". Disponibles: ${ACCIONES_V2.join(", ")}.`, 400);
  return fn(user, params ?? {});
}
