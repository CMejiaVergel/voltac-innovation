import "server-only";

import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/enums";
import { PLANTILLA_CONCEPTO, CONECTE_LOS_PUNTOS, INGENIERIA_INVERSA, fraseConectada } from "@/lib/gimi";
import { DETONANTE_KEYS } from "@/lib/enums";
import { parseShape } from "@/lib/templates";
import { getProjectRole } from "@/lib/projects";
import { AgentApiError } from "@/lib/agentApi";
import type { SessionUser } from "@/lib/auth";

/**
 * La etapa Convergir por la puerta del agente.
 *
 * Mismas reglas que la pantalla. Un concepto nace de ideas de Combinar —una o
 * varias, de uno o varios insights, que es como se escala una solucion— y las
 * ideas tienen que ser de ESTE proyecto. Uno que cite una idea ajena o
 * inexistente se rechaza entero, igual que un insight que cita un punto que
 * no esta en el mapa.
 *
 * El agente NO puntua por iniciativa propia. La matriz Atractividad × Fit es un
 * ejercicio del equipo (CV.pdf: evaluar, intercambiar el ranking con un par,
 * votar si hay empate). Un agente que llega con los seis numeros puestos le
 * quita al equipo justo la discusion que la etapa existe para provocar. Si el
 * equipo se lo pide, puntua, y deja escrito el porque de cada numero para que
 * haya contra que discutirlo.
 */

export type IncomingConcept = {
  titulo: string;
  /** Que es, en una frase. */
  enunciado: string;
  /** Los cinco elementos de la plantilla del GIMI (CB.pdf, lamina 44). */
  quienTieneElProblema?: string | null;
  necesidades?: string | null;
  solucion?: string | null;
  quienLaOfrece?: string | null;
  comoLoResuelve?: string | null;
  /** El punto caliente del mapa del que parte. */
  ancla?: string | null;
  /** Ids de InsightIdea. */
  ideas: string[];
  /**
   * Ejercicio 1.1 del Taller 3: las piezas de la frase «Conecte los puntos».
   * Cada una sale de una dimension del mapa.
   */
  oferta?: string | null;
  mercado?: string | null;
  necesidad?: string | null;
  entrega?: string | null;
  produccion?: string | null;
  modelo?: string | null;
  propuestaValor?: string | null;
  /** Vinetas del lienzo por dimension del mapa: { mercado: [...], oferta: [...] }. */
  lienzo?: Record<string, string[]> | null;
  /** Condiciones de ingenieria inversa (o precedentes dados por sentado). */
  supuestos?: CondicionEntrante[];
  /**
   * Ids de fragmentos ACEPTADOS del mapa que sostienen el concepto. Un concepto
   * completo recorre las cinco dimensiones con al menos uno en cada una.
   */
  fragmentos?: string[];
};

/** Una condicion de ingenieria inversa, tal como la manda el agente. */
export type CondicionEntrante = {
  texto: string;
  probabilidad?: number;
  /** CONDICION (defecto) | PRECEDENTE: lo que el proceso ya dio por sentado. */
  tipo?: string;
  /** Detonante del Taller 3: MODELO_NEGOCIO, PROVEEDOR, EMPLEADOS, PRODUCCION, OFERTA, ENTREGA, CLIENTES, ALIADOS, COMPETENCIA. */
  detonante?: string;
  /** Una de las tres menos probables. */
  critica?: boolean;
  /** Prueba de falla rapida. */
  prueba?: string;
  /** Resultado deseado o decision esperada. */
  resultado?: string;
};

function datosCondicion(x: CondicionEntrante) {
  const tipo = x.tipo === "PRECEDENTE" ? "PRECEDENTE" : "CONDICION";
  const detonante = (DETONANTE_KEYS as readonly string[]).includes(x.detonante ?? "") ? x.detonante! : "";
  return {
    text: (x.texto ?? "").trim(),
    likelihood: Math.min(5, Math.max(1, Math.round(Number(x.probabilidad ?? 3)))),
    kind: tipo,
    trigger: detonante,
    // Un precedente no se trabaja: no puede ser una de las tres.
    critical: tipo === "CONDICION" && Boolean(x.critica),
    failFastTest: (x.prueba ?? "").trim(),
    expectedResult: (x.resultado ?? "").trim(),
  };
}

/** Avisos del ejercicio de ingenieria inversa. No bloquean, igual que el resto. */
function avisosIngenieria(
  filas: { kind: string; critical: boolean; failFastTest: string; expectedResult: string; text: string }[],
): string[] {
  const condiciones = filas.filter((f) => f.kind === "CONDICION");
  const criticas = condiciones.filter((f) => f.critical);
  const avisos: string[] = [];
  if (condiciones.length > INGENIERIA_INVERSA.maxCondiciones) {
    avisos.push(`Hay ${condiciones.length} condiciones: el ejercicio pide hasta ${INGENIERIA_INVERSA.maxCondiciones}. Consolida las que dependen de otra.`);
  }
  if (condiciones.length > 0 && criticas.length !== INGENIERIA_INVERSA.menosProbables) {
    avisos.push(`Hay ${criticas.length} condiciones marcadas como menos probables: el ejercicio pide exactamente ${INGENIERIA_INVERSA.menosProbables}.`);
  }
  for (const c of criticas) {
    if (!c.failFastTest || !c.expectedResult) {
      avisos.push(`«${c.text.slice(0, 60)}» es de las menos probables y le falta ${!c.failFastTest ? "la prueba de falla rapida" : "el resultado esperado"}.`);
    }
  }
  return avisos;
}

/** Valida el lienzo contra las dimensiones del mapa y lo guarda como JSON. */
function lienzoValido(
  lienzo: Record<string, string[]> | null | undefined,
  dimensiones: { id: string }[],
): string | null {
  if (!lienzo) return null;
  const ids = new Set(dimensiones.map((d) => d.id));
  const ajenas = Object.keys(lienzo).filter((k) => !ids.has(k));
  if (ajenas.length > 0) {
    throw new AgentApiError(
      `El lienzo usa dimensiones que no estan en el mapa: ${ajenas.join(", ")}. Validas: ${[...ids].join(", ")}.`,
      400,
    );
  }
  const limpio = Object.fromEntries(
    Object.entries(lienzo).map(([k, v]) => [
      k,
      (Array.isArray(v) ? v : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 8),
    ]),
  );
  return JSON.stringify(limpio);
}

/** Las piezas de la frase que trae un concepto entrante, en columnas. */
function piezasFrase(c: {
  oferta?: string | null;
  mercado?: string | null;
  necesidad?: string | null;
  entrega?: string | null;
  produccion?: string | null;
  modelo?: string | null;
}): Record<string, string> {
  const valores: Record<string, string | null | undefined> = {
    fraseOferta: c.oferta,
    fraseMercado: c.mercado,
    fraseNecesidad: c.necesidad,
    fraseEntrega: c.entrega,
    fraseProduccion: c.produccion,
    fraseModelo: c.modelo,
  };
  const salida: Record<string, string> = {};
  for (const p of CONECTE_LOS_PUNTOS) {
    const v = valores[p.campo];
    if (typeof v === "string") salida[p.campo] = v.trim();
  }
  return salida;
}

// ─────────────────────────────────────────────────────────────────────────────
// Anclaje al mapa y cobertura de dimensiones
// ─────────────────────────────────────────────────────────────────────────────

/** Las dimensiones del mapa del proyecto, en el orden de su plantilla. */
async function dimensionesDe(projectId: string) {
  const map = await prisma.bomMap.findFirst({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: { id: true, template: { select: { rows: true, cols: true } } },
  });
  if (!map) throw new AgentApiError("El proyecto no tiene mapa.", 409);
  const shape = parseShape(map.template.rows, map.template.cols);
  return { mapId: map.id, dimensiones: shape.rows.map((r) => ({ id: r.id, nombre: r.name })) };
}

/**
 * Valida los fragmentos pedidos. Tienen que estar en el mapa del proyecto,
 * aceptados y visibles: un concepto no se apoya en una propuesta sin revisar,
 * igual que un insight.
 */
async function fragmentosValidos(mapId: string, ids: string[]) {
  const unicos = [...new Set(ids)];
  const encontrados = unicos.length
    ? await prisma.fragment.findMany({
        where: { id: { in: unicos }, mapId },
        select: { id: true, rowId: true, text: true, reviewState: true, hidden: true },
      })
    : [];
  const porId = new Map(encontrados.map((f) => [f.id, f]));
  const ajenos = unicos.filter((id) => !porId.has(id));
  if (ajenos.length > 0) {
    throw new AgentApiError(`Estos fragmentos no estan en el mapa: ${ajenos.join(", ")}.`, 400);
  }
  const noAceptados = encontrados.filter((f) => f.reviewState !== "ACCEPTED" || f.hidden);
  if (noAceptados.length > 0) {
    throw new AgentApiError(
      `Un concepto se apoya en fragmentos aceptados y visibles. No lo estan: ${noAceptados.map((f) => f.id).join(", ")}.`,
      400,
    );
  }
  return unicos.map((id) => porId.get(id)!);
}

function cobertura(dimensiones: { id: string; nombre: string }[], rowIds: string[]) {
  const presentes = new Set(rowIds);
  const faltantes = dimensiones.filter((d) => !presentes.has(d.id)).map((d) => d.nombre);
  return {
    porDimension: Object.fromEntries(dimensiones.map((d) => [d.id, rowIds.filter((r) => r === d.id).length])),
    dimensionesFaltantes: faltantes,
    completo: faltantes.length === 0,
  };
}

function normalizar(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Compone la descripcion con los cinco elementos rotulados, en el orden de la plantilla. */
function describir(c: IncomingConcept): string {
  const valores: Record<string, string | null | undefined> = {
    quienTieneElProblema: c.quienTieneElProblema,
    necesidades: c.necesidades,
    solucion: c.solucion,
    quienLaOfrece: c.quienLaOfrece,
    comoLoResuelve: c.comoLoResuelve,
  };
  const partes = PLANTILLA_CONCEPTO.map((e) => {
    const v = (valores[e.campo] ?? "").trim();
    return v ? `${e.pregunta}\n${v}` : null;
  }).filter(Boolean);
  if (c.ancla?.trim()) partes.unshift(`Ancla en el mapa\n${c.ancla.trim()}`);
  return partes.join("\n\n");
}

export async function createConcepts(
  user: SessionUser,
  slug: string,
  items: IncomingConcept[],
  estado: "PROPOSED" | "ACCEPTED" = "PROPOSED",
) {
  const project = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
  if (!project) throw new AgentApiError(`No existe el proyecto "${slug}".`, 404);
  const access = await getProjectRole(user, project.id);
  if (!access) throw new AgentApiError("El proyecto no existe.", 404);
  if (!canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }

  const ideas = await prisma.insightIdea.findMany({
    where: { insight: { projectId: project.id } },
    select: { id: true, text: true, insightId: true },
  });
  const porId = new Map(ideas.map((i) => [i.id, i]));

  const existentes = await prisma.concept.findMany({
    where: { projectId: project.id },
    select: { title: true },
  });
  const yaEscritos = new Set(existentes.map((e) => normalizar(e.title)));

  const ultimo = await prisma.concept.findFirst({
    where: { projectId: project.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let posicion = (ultimo?.position ?? -1) + 1;
  const { mapId, dimensiones } = await dimensionesDe(project.id);

  const creados: { id: string; titulo: string; dimensionesFaltantes: string[] }[] = [];
  const rechazados: { titulo: string; motivo: string }[] = [];

  for (const item of items) {
    const titulo = (item.titulo ?? "").trim();
    const enunciado = (item.enunciado ?? "").trim();

    if (!titulo || enunciado.length < 20) {
      rechazados.push({ titulo, motivo: "Hace falta el nombre y un enunciado de al menos una frase." });
      continue;
    }
    if (yaEscritos.has(normalizar(titulo))) {
      rechazados.push({ titulo, motivo: "Ya existe un concepto con ese nombre." });
      continue;
    }

    const unicas = [...new Set(item.ideas ?? [])];
    if (unicas.length === 0) {
      rechazados.push({
        titulo,
        motivo: "Un concepto sale de al menos una idea de Combinar. Sin ideas no hay de donde rastrearlo.",
      });
      continue;
    }
    const ajenas = unicas.filter((id) => !porId.has(id));
    if (ajenas.length > 0) {
      rechazados.push({
        titulo,
        motivo: `Estas ideas no existen en este proyecto: ${ajenas.join(", ")}. Los ids salen de leer_proyecto con insights en detalle completo.`,
      });
      continue;
    }

    let anclas: Awaited<ReturnType<typeof fragmentosValidos>>;
    try {
      anclas = await fragmentosValidos(mapId, item.fragmentos ?? []);
    } catch (e) {
      rechazados.push({ titulo, motivo: e instanceof Error ? e.message : "Fragmentos invalidos." });
      continue;
    }

    const supuestos = (item.supuestos ?? []).map(datosCondicion).filter((s) => s.text);

    let lienzo: string | null;
    try {
      lienzo = lienzoValido(item.lienzo, dimensiones);
    } catch (e) {
      rechazados.push({ titulo, motivo: e instanceof Error ? e.message : "Lienzo invalido." });
      continue;
    }
    const frase = piezasFrase(item);

    const concepto = await prisma.concept.create({
      data: {
        projectId: project.id,
        authorId: user.id,
        origin: "AGENT",
        reviewState: estado,
        position: posicion++,
        title: titulo.slice(0, 120),
        statement: enunciado,
        description: describir(item),
        ...frase,
        propuestaValor: (item.propuestaValor ?? "").trim(),
        ...(lienzo ? { lienzo } : {}),
        origenes: {
          create: unicas.map((id) => {
            const idea = porId.get(id)!;
            return { ideaId: idea.id, textSnapshot: idea.text, insightId: idea.insightId };
          }),
        },
        supuestos: {
          create: supuestos.map((s, i) => ({ ...s, position: i, origin: "AGENT" })),
        },
        anclas: {
          create: anclas.map((f, i) => ({
            fragmentId: f.id,
            rowId: f.rowId,
            textSnapshot: f.text,
            position: i,
          })),
        },
      },
      select: { id: true, title: true },
    });

    yaEscritos.add(normalizar(titulo));
    creados.push({
      id: concepto.id,
      titulo: concepto.title,
      dimensionesFaltantes: cobertura(dimensiones, anclas.map((f) => f.rowId)).dimensionesFaltantes,
    });
  }

  return {
    creados,
    rechazados,
    ...(creados.some((c) => c.dimensionesFaltantes.length > 0)
      ? {
          aviso:
            "Hay conceptos incompletos: un concepto de negocio recorre las cinco dimensiones del mapa con al menos un fragmento en cada una.",
        }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Correccion y puntuacion
// ─────────────────────────────────────────────────────────────────────────────

type ColumnaPuntaje =
  | "atrMercado"
  | "atrOpciones"
  | "atrRecompensa"
  | "fitViabilidad"
  | "fitEstrategia"
  | "fitPasion";

/**
 * Nombres de la API, en español, contra las columnas de los seis subcriterios
 * del Ejercicio 2. Los nombres anteriores al Taller 3 siguen aceptandose y caen
 * en la columna a la que se renombraron en la migracion.
 */
const PUNTUACION: Record<string, ColumnaPuntaje> = {
  mercado: "atrMercado",
  opciones: "atrOpciones",
  recompensa: "atrRecompensa",
  viabilidad: "fitViabilidad",
  estrategia: "fitEstrategia",
  pasion: "fitPasion",
  // alias anteriores
  demanda: "atrMercado",
  escalar: "atrOpciones",
  resuelveProblema: "atrRecompensa",
  implementar: "fitViabilidad",
  metas: "fitEstrategia",
  atractivoEquipo: "fitPasion",
};

const ROTULO_JUSTIFICACION = "Por qué esta puntuación";

export type ConceptPatch = {
  titulo?: string;
  enunciado?: string;
  estado?: string;
  /** Escala 1 a 5; 0 deja el subcriterio sin puntuar. */
  puntuacion?: Partial<Record<keyof typeof PUNTUACION, number>>;
  /**
   * Por que cada numero. Se guarda al final de la descripcion, reemplazando la
   * justificacion anterior si la habia. Sin esto el equipo ve un 2 y no sabe
   * contra que discutirlo, que es para lo que existe la matriz.
   */
  justificacion?: string;
  /**
   * Los cinco elementos de la plantilla y el ancla. Si viene cualquiera, tienen
   * que venir los cinco: la descripcion se recompone entera y no se intenta
   * fusionar a ciegas con el texto anterior. La justificacion de la puntuacion
   * se conserva.
   */
  /** Reemplaza los fragmentos que sostienen el concepto. */
  fragmentos?: string[];
  /** Añade condiciones al final; las existentes no se tocan. */
  supuestosNuevos?: CondicionEntrante[];
  /** Corrige condiciones existentes de este concepto, por id. */
  supuestosEditar?: (Partial<CondicionEntrante> & { id: string })[];
  /**
   * Elimina condiciones de este concepto, por id. Sirve para consolidar las que
   * dependian de otra. Si un artefacto las exponia, se pierde ese enlace.
   */
  supuestosEliminar?: string[];
  /** Piezas de la frase «Conecte los puntos». Se corrigen de a una. */
  oferta?: string;
  mercado?: string;
  necesidad?: string;
  entrega?: string;
  produccion?: string;
  modelo?: string;
  propuestaValor?: string;
  /** Reemplaza el lienzo entero. */
  lienzo?: Record<string, string[]>;
  quienTieneElProblema?: string;
  necesidades?: string;
  solucion?: string;
  quienLaOfrece?: string;
  comoLoResuelve?: string;
  ancla?: string;
};

export async function updateConceptById(user: SessionUser, id: string, cambios: ConceptPatch) {
  const concepto = await prisma.concept.findUnique({
    where: { id },
    select: { id: true, projectId: true, description: true },
  });
  if (!concepto) throw new AgentApiError("El concepto no existe.", 404);
  const access = await getProjectRole(user, concepto.projectId);
  if (!access) throw new AgentApiError("El concepto no existe.", 404);
  if (!canEdit(access.role)) {
    throw new AgentApiError("El token no tiene permiso de escritura en este proyecto.", 403);
  }

  const data: Record<string, unknown> = {};
  if (typeof cambios.titulo === "string" && cambios.titulo.trim()) data.title = cambios.titulo.trim();
  if (typeof cambios.enunciado === "string" && cambios.enunciado.trim()) {
    data.statement = cambios.enunciado.trim();
  }
  if (cambios.estado && ["ACCEPTED", "PROPOSED", "REJECTED"].includes(cambios.estado)) {
    data.reviewState = cambios.estado;
  }

  for (const [nombre, valor] of Object.entries(cambios.puntuacion ?? {})) {
    const columna = PUNTUACION[nombre];
    if (!columna) throw new AgentApiError(`No existe el subcriterio "${nombre}".`, 400);
    const n = Math.round(Number(valor));
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      throw new AgentApiError(`"${nombre}" va de 1 a 5, o 0 para dejarlo sin puntuar.`, 400);
    }
    data[columna] = n;
  }

  const [baseActual, justificacionActual] = concepto.description.split(`\n\n${ROTULO_JUSTIFICACION}\n`);
  const ELEMENTOS = PLANTILLA_CONCEPTO.map((e) => e.campo);
  const traeElementos = ELEMENTOS.some((c) => typeof cambios[c] === "string");

  if (traeElementos) {
    const faltan = ELEMENTOS.filter((c) => !(typeof cambios[c] === "string" && cambios[c]!.trim()));
    if (faltan.length > 0) {
      throw new AgentApiError(
        `Para corregir la descripcion hay que enviar los cinco elementos. Faltan: ${faltan.join(", ")}.`,
        400,
      );
    }
  }

  const nuevaBase = traeElementos
    ? describir({ ...(cambios as IncomingConcept), titulo: "", enunciado: "", ideas: [] })
    : baseActual.trimEnd();
  const nuevaJustificacion =
    typeof cambios.justificacion === "string" && cambios.justificacion.trim()
      ? cambios.justificacion.trim()
      : justificacionActual?.trim();

  if (traeElementos || (typeof cambios.justificacion === "string" && cambios.justificacion.trim())) {
    data.description = nuevaJustificacion
      ? `${nuevaBase}\n\n${ROTULO_JUSTIFICACION}\n${nuevaJustificacion}`
      : nuevaBase;
  }

  const { mapId, dimensiones } = await dimensionesDe(concepto.projectId);
  const anclas = cambios.fragmentos ? await fragmentosValidos(mapId, cambios.fragmentos) : null;
  const nuevos = (cambios.supuestosNuevos ?? []).map(datosCondicion).filter((x) => x.text);

  Object.assign(data, piezasFrase(cambios));
  if (typeof cambios.propuestaValor === "string") data.propuestaValor = cambios.propuestaValor.trim();
  const lienzo = lienzoValido(cambios.lienzo, dimensiones);
  if (lienzo) data.lienzo = lienzo;

  // Las condiciones a corregir o eliminar tienen que ser de ESTE concepto.
  const idsTocados = [
    ...(cambios.supuestosEditar ?? []).map((x) => x.id),
    ...(cambios.supuestosEliminar ?? []),
  ];
  if (idsTocados.length > 0) {
    const propios = await prisma.assumption.findMany({
      where: { id: { in: idsTocados }, conceptId: id },
      select: { id: true },
    });
    const suyos = new Set(propios.map((x) => x.id));
    const ajenos = idsTocados.filter((x) => !suyos.has(x));
    if (ajenos.length > 0) {
      throw new AgentApiError(`Estas condiciones no son de este concepto: ${ajenos.join(", ")}.`, 400);
    }
  }
  const editar = cambios.supuestosEditar ?? [];
  const eliminar = cambios.supuestosEliminar ?? [];

  if (
    Object.keys(data).length === 0 &&
    !anclas &&
    nuevos.length === 0 &&
    editar.length === 0 &&
    eliminar.length === 0
  ) {
    throw new AgentApiError("El cambio no trae ningun campo reconocido.", 400);
  }

  for (const x of editar) {
    const d: Record<string, unknown> = {};
    if (typeof x.texto === "string" && x.texto.trim()) d.text = x.texto.trim();
    if (x.probabilidad !== undefined) d.likelihood = Math.min(5, Math.max(1, Math.round(Number(x.probabilidad))));
    if (x.tipo === "CONDICION" || x.tipo === "PRECEDENTE") d.kind = x.tipo;
    if (typeof x.detonante === "string") {
      d.trigger = (DETONANTE_KEYS as readonly string[]).includes(x.detonante) ? x.detonante : "";
    }
    if (typeof x.critica === "boolean") d.critical = x.critica && x.tipo !== "PRECEDENTE";
    if (typeof x.prueba === "string") d.failFastTest = x.prueba.trim();
    if (typeof x.resultado === "string") d.expectedResult = x.resultado.trim();
    if (Object.keys(d).length > 0) await prisma.assumption.update({ where: { id: x.id }, data: d });
  }
  if (eliminar.length > 0) {
    await prisma.assumption.deleteMany({ where: { id: { in: eliminar }, conceptId: id } });
  }

  if (anclas) {
    await prisma.conceptFragment.deleteMany({ where: { conceptId: id } });
    await prisma.conceptFragment.createMany({
      data: anclas.map((f, i) => ({
        conceptId: id,
        fragmentId: f.id,
        rowId: f.rowId,
        textSnapshot: f.text,
        position: i,
      })),
    });
  }
  if (nuevos.length > 0) {
    const ultimoSup = await prisma.assumption.findFirst({
      where: { conceptId: id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let pos = (ultimoSup?.position ?? -1) + 1;
    for (const n of nuevos) {
      await prisma.assumption.create({
        data: { conceptId: id, ...n, position: pos++, origin: "AGENT" },
      });
    }
  }

  const actualizado = await prisma.concept.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      atrMercado: true,
      atrOpciones: true,
      atrRecompensa: true,
      fitViabilidad: true,
      fitEstrategia: true,
      fitPasion: true,
      fraseOferta: true,
      fraseMercado: true,
      fraseNecesidad: true,
      fraseEntrega: true,
      fraseProduccion: true,
      fraseModelo: true,
      anclas: { select: { rowId: true } },
      supuestos: {
        select: { kind: true, critical: true, failFastTest: true, expectedResult: true, text: true },
      },
    },
  });
  const { anclas: filas, supuestos: condiciones, ...resto } = actualizado;
  const avisos = avisosIngenieria(condiciones);
  return {
    actualizado: { ...resto, frase: fraseConectada(resto) },
    supuestosAgregados: nuevos.length,
    supuestosEditados: editar.length,
    supuestosEliminados: eliminar.length,
    ...cobertura(dimensiones, filas.map((a) => a.rowId)),
    ...(avisos.length > 0 ? { avisosIngenieriaInversa: avisos } : {}),
  };
}
