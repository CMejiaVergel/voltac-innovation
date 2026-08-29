/**
 * Semilla de la instancia.
 *
 * Inserta, de forma idempotente:
 *   1. Las dos plantillas de mapa del sistema.
 *   2. El usuario administrador inicial (credenciales desde .env).
 *   3. El proyecto Cabot — Caribe Innova 2026, con su brief, su mapa 5x5,
 *      los 110 fragmentos del prototipo, la bibliografia verificada y el banco
 *      de preguntas pendientes.
 *
 * Sobre el estado de verificacion de los fragmentos migrados: el prototipo no
 * guardaba fuente por fragmento, asi que TODOS entran como "Por confirmar"
 * salvo los que corresponden a la bibliografia ya verificada del documento de
 * contexto (seccion 6), que se marcan "Verificado" por coincidencia explicita
 * declarada en VERIFIED_MATCHES. Nada entra como hecho sin respaldo: eso es
 * justamente lo que la advertencia 2 del contexto pide evitar.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SYSTEM_TEMPLATES } from "../src/lib/templates";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fragmentos que la seccion 6 del contexto ya respalda con fuente publica.
 * La clave es un fragmento de texto que debe aparecer en el fragmento; el valor
 * es el titulo de la fuente en la bibliografia.
 */
const VERIFIED_MATCHES: Array<[string, string]> = [
  ["Kalundborg", "Kalundborg Symbiosis"],
  ["millas vacias", "Uber Freight — millas vacias"],
  ["Uber Freight", "Uber Freight — millas vacias"],
  ["Resolucion 1256", "MinAmbiente — Resolucion 1256 de 2021"],
  ["Resolucion 631", "MinAmbiente — Resolucion 631 de 2015"],
  ["racionamiento", "Acuacar — racionamiento Cartagena 2026"],
  ["Virtual Power Plant", "ARENA / Tesla / AGL — VPP Australia del Sur"],
  ["planta de energia virtual", "ARENA / Tesla / AGL — VPP Australia del Sur"],
  ["CDP", "Cabot — Reporte de Sostenibilidad 2025"],
  ["10% la intensidad", "Cabot — Metas de Sostenibilidad 2030"],
];

const BIBLIOGRAPHY = [
  {
    title: "Cabot — Metas de Sostenibilidad 2030",
    url: "https://www.cabotcorp.com/sustainability",
    publisher: "Cabot Corporation",
    year: "2025",
    note: "Meta de reducir 10% la intensidad de captacion de agua dulce en sitios con estres hidrico. Meta de exportar 250% de la energia que importa.",
  },
  {
    title: "Cabot — Reporte de Sostenibilidad 2025",
    url: "https://www.cabotcorp.com/sustainability",
    publisher: "Cabot Corporation",
    year: "2025",
    note: "Publicado en septiembre de 2025. Calificacion A- en CDP Water Security 2025.",
  },
  {
    title: "MinAmbiente — Resolucion 1256 de 2021",
    url: "https://www.minambiente.gov.co",
    publisher: "Ministerio de Ambiente y Desarrollo Sostenible de Colombia",
    year: "2021",
    note: "Reglamenta reuso y recirculacion de aguas residuales. Elimina los parametros de calidad para uso industrial y los deja a definicion de cada actividad. Define el Punto de Control como responsabilidad del Usuario Receptor.",
  },
  {
    title: "MinAmbiente — Resolucion 631 de 2015",
    url: "https://www.minambiente.gov.co",
    publisher: "Ministerio de Ambiente y Desarrollo Sostenible de Colombia",
    year: "2015",
    note: "Norma de vertimiento. Citada por Cabot en el Que Evitar del reto.",
  },
  {
    title: "Acuacar — racionamiento Cartagena 2026",
    url: "",
    publisher: "Acuacar / prensa nacional",
    year: "2026",
    note: "Racionamiento programado de agua en Cartagena, mayo de 2026.",
  },
  {
    title: "Kalundborg Symbiosis",
    url: "https://www.symbiosis.dk/en/",
    publisher: "Kalundborg Symbiosis",
    year: "",
    note: "17 empresas, mas de 30 flujos de recursos, 4 millones de m3/año de agua subterranea ahorrada.",
  },
  {
    title: "Uber Freight — millas vacias",
    url: "https://www.uberfreight.com",
    publisher: "Uber Freight",
    year: "",
    note: "Millas vacias entre 20% y 35% del sector; 44,9% en transportistas de cisterna; reduccion de 22,6% mediante agrupamiento algoritmico.",
  },
  {
    title: "ARENA / Tesla / AGL — VPP Australia del Sur",
    url: "https://arena.gov.au",
    publisher: "Australian Renewable Energy Agency",
    year: "",
    note: "Hasta 50.000 hogares agregados para entregar 250 MW y 650 MWh.",
  },
  {
    title: "UN ESCWA DEPAR — Business Opportunity Mapping",
    url: "https://www.unescwa.org",
    publisher: "UN ESCWA",
    year: "",
    note: "Descripcion publica del metodo: fragmentos de idea, metafora del mapa estelar, oportunidades como constelaciones.",
  },
];

/** Advertencia 2 del contexto: lo que sigue sin confirmar no se rellena, se pregunta. */
const OPEN_QUESTIONS = [
  "Los 600 kg/h de CT1 mas 400 kg/h de CT2 son realmente el 10% objetivo? Equivaldrian a ~1 m3/h, unos 24 m3/dia.",
  "Cual es el consumo total de agua cruda de la planta de Cartagena?",
  "Cual es el costo actual por m3 de agua cruda entregada por Acuacar?",
  "Cual es la especificacion de calidad de agua exigida por CT1 y CT2 (conductividad, dureza, silice, cloruros)?",
  "El sitio de Cartagena esta clasificado por Cabot como zona de estres hidrico?",
  "Cual es el presupuesto disponible para infraestructura de transporte y almacenamiento del efluente?",
  "Que empresas vecinas del corredor de Mamonal ya estan dispuestas a conversar sobre entrega de efluentes?",
];

const CHALLENGE_TEXT =
  "Reduccion del 10% del consumo de agua cruda (600 kg/h CT1, 400 kg/h CT2) por enfriamiento a traves del reuso de aguas de rechazo en plantas vecinas.";

const QUE_HACER = [
  "Buscar en empresas del sector purgas de caldera, torres de enfriamiento y condensados de stripping que puedan usarse para quench o refrigeracion",
  "Caracterizar efluentes procurando especies y concentraciones similares al agua cruda",
  "Evaluar metodo de transporte y almacenamiento",
  "Evaluar requerimientos legales para nueva disposicion de efluentes",
  "Validar modelo de precios cubriendo al menos costos de operacion mas 10% AIU",
];

const QUE_EVITAR = [
  "Efluentes demasiado alejados de los contenidos maximos de la Resolucion 631",
  "Cantidades muy pequeñas",
  "Contaminantes metalicos o que generen depositos dificiles de manejar por evaporacion",
  "Aguas negras",
  "Requerimientos de tramites legales extensos (zonas francas, permisos de vertimiento)",
];

// ─────────────────────────────────────────────────────────────────────────────

function classify(text: string): { verification: string; sourceTitle: string | null } {
  const haystack = text.toLowerCase();
  for (const [needle, sourceTitle] of VERIFIED_MATCHES) {
    if (haystack.includes(needle.toLowerCase())) {
      return { verification: "VERIFIED", sourceTitle };
    }
  }
  return { verification: "TO_CONFIRM", sourceTitle: null };
}

async function main() {
  // 1. Plantillas del sistema ────────────────────────────────────────────────
  for (const t of SYSTEM_TEMPLATES) {
    await prisma.mapTemplate.upsert({
      where: { key: t.key },
      update: {
        name: t.name,
        description: t.description,
        rows: JSON.stringify(t.shape.rows),
        cols: JSON.stringify(t.shape.cols),
        isSystem: true,
      },
      create: {
        key: t.key,
        name: t.name,
        description: t.description,
        rows: JSON.stringify(t.shape.rows),
        cols: JSON.stringify(t.shape.cols),
        isSystem: true,
      },
    });
  }
  console.log(`✓ ${SYSTEM_TEMPLATES.length} plantillas del sistema`);

  // 2. Administrador inicial ─────────────────────────────────────────────────
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@voltac.com.co").toLowerCase();
  const name = process.env.SEED_ADMIN_NAME ?? "Administrador";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "cambiar-en-el-primer-login";

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", active: true },
    create: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`✓ Administrador: ${admin.email}`);

  // 3. Proyecto Cabot ────────────────────────────────────────────────────────
  const existing = await prisma.project.findUnique({ where: { slug: "cabot-cartagena" } });
  if (existing) {
    console.log("• El proyecto cabot-cartagena ya existe: no se toca.");
    return;
  }

  const project = await prisma.project.create({
    data: {
      slug: "cabot-cartagena",
      name: "Reuso de agua de rechazo — Cabot Cartagena",
      company: "Cabot Corporation — planta Cartagena (Mamonal)",
      program: "Caribe Innova 2026",
      createdById: admin.id,
      members: { create: { userId: admin.id, role: "OWNER" } },
      brief: {
        create: {
          challengeText: CHALLENGE_TEXT,
          problema:
            "La planta de Cartagena consume agua cruda de Acuacar para enfriamiento en CT1 y CT2. La ciudad entro en racionamiento y el agua es un insumo en competencia con el consumo urbano. Hay que sustituir parte de esa captacion con efluentes de plantas vecinas del corredor de Mamonal.",
          porQueMotivante:
            "Cierra un ciclo de agua en un corredor industrial con estres hidrico y convierte un residuo de un vecino en insumo de Cabot. El beneficio es simultaneamente ambiental, reputacional y de costo.",
          meta: "Reducir 10% el consumo de agua cruda de enfriamiento mediante reuso de efluentes de terceros, con un modelo de precios que cubra operacion mas 10% AIU.",
          solutionFoci: JSON.stringify(["COSTO", "TECNOLOGIA", "MODELOS", "COLABORACION"]),
          queHacer: JSON.stringify(QUE_HACER),
          queEvitar: JSON.stringify(QUE_EVITAR),
          restricciones:
            "El ahorro en agua debe superar el gasto operativo de traerla: si transportarla cuesta 10, el excedente debe ser mayor a 10 para que el 10% de ahorro quede libre. El efluente no puede alejarse de los contenidos maximos de la Resolucion 631 ni traer metales o especies incrustantes.",
          razonDeCambio: "ENTORNO",
          brechaCrecimiento:
            "10% del consumo de agua cruda de enfriamiento, equivalente a lo aportado por CT1 (600 kg/h) y CT2 (400 kg/h), pendiente de confirmar con la empresa.",
          perfilInversion: "NUCLEO_LEJOS",
          agentHints:
            "Corredor industrial de Mamonal, Cartagena. Simbiosis industrial, reuso de agua industrial, purgas de caldera, condensados de stripping, torres de enfriamiento, negro de humo, Resolucion 1256 de 2021, Acuacar, Canal del Dique.",
          agentExclude:
            "Aguas negras y residuales domesticas. Soluciones que requieran permisos de vertimiento nuevos o tramites de zona franca.",
        },
      },
    },
  });
  console.log(`✓ Proyecto: ${project.name}`);

  // 4. Bibliografia ──────────────────────────────────────────────────────────
  const sources = new Map<string, string>();
  for (const b of BIBLIOGRAPHY) {
    const s = await prisma.source.create({ data: { ...b, projectId: project.id } });
    sources.set(b.title, s.id);
  }
  console.log(`✓ ${BIBLIOGRAPHY.length} fuentes en la bibliografia`);

  // 5. Preguntas pendientes ──────────────────────────────────────────────────
  await prisma.openQuestion.createMany({
    data: OPEN_QUESTIONS.map((text) => ({
      projectId: project.id,
      text,
      askedTo: "Cabot",
      origin: "HUMAN" as const,
    })),
  });
  console.log(`✓ ${OPEN_QUESTIONS.length} preguntas pendientes para Cabot`);

  // 6. Mapa 5x5 con los fragmentos del prototipo ─────────────────────────────
  const template = await prisma.mapTemplate.findUniqueOrThrow({ where: { key: "gimi-5x5" } });
  const map = await prisma.bomMap.create({
    data: { projectId: project.id, templateId: template.id },
  });

  const seedPath = join(process.cwd(), "prisma", "data", "seed-cabot.json");
  const raw = JSON.parse(readFileSync(seedPath, "utf8")) as Record<string, string[]>;

  let n = 0;
  let verified = 0;
  for (const [key, texts] of Object.entries(raw)) {
    const [rowId, colId] = key.split("|");
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      const { verification, sourceTitle } = classify(text);
      if (verification === "VERIFIED") verified++;

      const fragment = await prisma.fragment.create({
        data: {
          mapId: map.id,
          rowId,
          colId,
          text,
          position: i,
          verification,
          reviewState: "ACCEPTED",
          origin: "HUMAN",
          authorId: admin.id,
          sourceId: sourceTitle ? sources.get(sourceTitle) : null,
        },
      });

      await prisma.fragmentRevision.create({
        data: {
          mapId: map.id,
          fragmentId: fragment.id,
          action: "CREATE",
          text,
          rowId,
          colId,
          verification,
          reviewState: "ACCEPTED",
          note: "Migrado del prototipo bom-cabot.html",
          editedById: admin.id,
        },
      });
      n++;
    }
  }
  console.log(`✓ ${n} fragmentos en el mapa (${verified} verificados, ${n - verified} por confirmar)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
