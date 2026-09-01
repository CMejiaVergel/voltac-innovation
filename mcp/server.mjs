#!/usr/bin/env node
/**
 * Servidor MCP de la Plataforma de Innovacion Voltac.
 *
 * Expone el Mapa de Oportunidades como herramientas para que un cliente MCP
 * —Claude Code -- pueda actuar como agente investigador: leer el reto, ver que
 * celdas estan flacas, proponer fragmentos y registrar preguntas y fuentes.
 *
 * No habla con la base de datos. Habla con /api/agent, que es la misma capa de
 * reglas que usa la interfaz: control de acceso por proyecto, validacion de
 * coordenadas contra la plantilla e historial obligatorio. Un fallo aqui no
 * puede saltarse una regla del metodo.
 *
 * Configuracion (variables de entorno):
 *   VOLTAC_API_URL    https://innovation.voltac.com.co   (o http://localhost:3000)
 *   VOLTAC_API_TOKEN  el token de `npm run token:crear`
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE = (process.env.VOLTAC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const TOKEN = process.env.VOLTAC_API_TOKEN ?? "";

async function api(path, { method = "GET", body } = {}) {
  if (!TOKEN) {
    throw new Error(
      "Falta VOLTAC_API_TOKEN. Crea uno con `npm run token:crear -- --email tu@correo` " +
        "y ponlo en la configuracion del servidor MCP.",
    );
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Respuesta no JSON de ${path} (${res.status}): ${text.slice(0, 300)}`);
  }
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status} en ${path}`);
  return data;
}

const slugPath = (slug) => `/api/agent/proyectos/${encodeURIComponent(slug)}`;

// ─────────────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "listar_proyectos",
    description:
      "Lista los proyectos de innovacion visibles, con su slug y cuantos fragmentos tiene su mapa. Empieza siempre por aqui para obtener el slug.",
    inputSchema: { type: "object", properties: {} },
    run: () => api("/api/agent/proyectos"),
  },
  {
    name: "leer_proyecto",
    description:
      "Contexto completo de un proyecto: el reto, el brief (que hacer / que evitar / restricciones), la plantilla del mapa con la REGLA de cada columna, el conteo por celda y todos los fragmentos que ya existen. Leelo ANTES de proponer nada: contiene las reglas que debes respetar y los fragmentos que no debes repetir.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Slug del proyecto." } },
      required: ["slug"],
    },
    run: ({ slug }) => api(slugPath(slug)),
  },
  {
    name: "proponer_fragmentos",
    description:
      "Agrega fragmentos al Mapa de Oportunidades. Un fragmento es UNA observacion cruda de maximo 25 palabras, sin conclusiones ni insights. Por defecto entran como PROPOSED y esperan revision humana en la aplicacion. El servidor rechaza duplicados y celdas que no existen, y degrada a 'por confirmar' cualquier fragmento marcado VERIFIED que llegue sin fuenteUrl.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        estado: {
          type: "string",
          enum: ["PROPOSED", "ACCEPTED"],
          description:
            "PROPOSED (por defecto) deja el fragmento en la cola de revision. ACCEPTED lo mete directo al mapa: usalo solo si la persona lo pidio explicitamente.",
        },
        fragmentos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fila: { type: "string", description: "id de fila de la plantilla, ej. mercado" },
              columna: { type: "string", description: "id de columna, ej. adyac" },
              texto: { type: "string", description: "La observacion. Max 25 palabras." },
              verificacion: {
                type: "string",
                enum: ["VERIFIED", "TO_CONFIRM", "ASSUMPTION"],
                description:
                  "VERIFIED exige fuenteUrl real consultada en esta sesion. Si dudas, TO_CONFIRM.",
              },
              fuenteUrl: { type: "string" },
              fuenteCita: { type: "string", description: "Titulo de la fuente." },
              porQueAqui: {
                type: "string",
                description: "Una frase: por que esta celda y no otra.",
              },
            },
            required: ["fila", "columna", "texto"],
          },
        },
      },
      required: ["slug", "fragmentos"],
    },
    run: ({ slug, fragmentos, estado }) =>
      api(`${slugPath(slug)}/fragmentos`, { method: "POST", body: { fragmentos, estado } }),
  },
  {
    name: "editar_fragmento",
    description:
      "Corrige un fragmento existente: su texto, la celda donde vive, su estado de verificacion o su fuente. Util para reubicar fragmentos mal colocados.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        texto: { type: "string" },
        fila: { type: "string" },
        columna: { type: "string" },
        verificacion: { type: "string", enum: ["VERIFIED", "TO_CONFIRM", "ASSUMPTION"] },
        estado: { type: "string", enum: ["ACCEPTED", "PROPOSED", "REJECTED"] },
        fuenteUrl: { type: "string" },
        fuenteCita: { type: "string" },
        porQueAqui: { type: "string" },
      },
      required: ["id"],
    },
    run: ({ id, ...patch }) =>
      api(`/api/agent/fragmentos/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  },
  {
    name: "eliminar_fragmento",
    description:
      "Borra un fragmento. Su historial sobrevive al borrado, asi que la operacion queda auditada. Usalo solo cuando el fragmento este mal de raiz; si solo esta mal ubicado, muevelo con editar_fragmento.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    run: ({ id }) =>
      api(`/api/agent/fragmentos/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  {
    name: "actualizar_brief",
    description:
      "Corrige campos de la etapa Configurar (el brief) de un proyecto. Solo escribe los campos que envies: corregir el reto no borra la meta. Usalo cuando la investigacion contradiga lo que dice el brief, o cuando la empresa entregue informacion nueva.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        reto: { type: "string", description: "Reto textual entregado por la empresa, literal." },
        problema: { type: "string" },
        porQueMotivante: { type: "string" },
        meta: { type: "string", description: "Brecha a cerrar y para cuando." },
        queHacer: { type: "array", items: { type: "string" } },
        queEvitar: { type: "array", items: { type: "string" } },
        restricciones: { type: "string" },
        brechaCrecimiento: { type: "string" },
        priorizarEnBusqueda: { type: "string" },
        excluirDeBusqueda: { type: "string" },
      },
      required: ["slug"],
    },
    run: ({ slug, ...patch }) =>
      api(`${slugPath(slug)}/brief`, { method: "PATCH", body: patch }),
  },
  {
    name: "registrar_preguntas",
    description:
      "Anota preguntas para la empresa. Es donde va lo que NO pudiste verificar: un dato que falta se pregunta, no se inventa como fragmento.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        preguntas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              texto: { type: "string" },
              paraQuien: { type: "string", description: "Empresa o actor a quien se pregunta." },
            },
            required: ["texto"],
          },
        },
      },
      required: ["slug", "preguntas"],
    },
    run: ({ slug, preguntas }) =>
      api(`${slugPath(slug)}/preguntas`, { method: "POST", body: { preguntas } }),
  },
  {
    name: "curar_preguntas",
    description:
      "Edita, elimina y reordena preguntas del banco en una sola llamada. Usalo para quitar duplicados, reformular una pregunta mal planteada o decidir el orden en que se preguntaran. Los ids salen de leer_proyecto.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        editar: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              texto: { type: "string" },
              resuelve: {
                type: "string",
                description:
                  "Quien la resuelve. No siempre es la empresa: varias se resuelven investigando.",
              },
              estado: { type: "string", enum: ["OPEN", "ANSWERED", "DISCARDED"] },
              respuesta: { type: "string" },
            },
            required: ["id"],
          },
        },
        eliminar: { type: "array", items: { type: "string" } },
        orden: {
          type: "array",
          items: { type: "string" },
          description: "Ids en el orden final deseado.",
        },
      },
      required: ["slug"],
    },
    run: ({ slug, ...body }) =>
      api(`${slugPath(slug)}/preguntas/gestion`, { method: "POST", body }),
  },
  {
    name: "registrar_fuentes",
    description:
      "Agrega entradas a la bibliografia del proyecto. Toda afirmacion del mapa deberia poder rastrearse hasta aqui.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        fuentes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string" },
              url: { type: "string" },
              editor: { type: "string" },
              anio: { type: "string" },
              nota: { type: "string", description: "Que dice y por que importa." },
            },
            required: ["titulo"],
          },
        },
      },
      required: ["slug", "fuentes"],
    },
    run: ({ slug, fuentes }) =>
      api(`${slugPath(slug)}/fuentes`, { method: "POST", body: { fuentes } }),
  },
  {
    name: "clonar_proyecto",
    description:
      "Crea una copia completa de un proyecto (brief, plantilla, fragmentos, bibliografia y preguntas) para poder experimentar sin tocar el original. No copia el historial ni las corridas del agente.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        sufijo: { type: "string", description: 'Se añade al nombre. Por defecto "(prueba)".' },
        incluirFragmentos: {
          type: "boolean",
          description: "false deja el mapa de la copia vacio. Por defecto true.",
        },
      },
      required: ["slug"],
    },
    run: ({ slug, sufijo, incluirFragmentos }) =>
      api(`${slugPath(slug)}/clonar`, {
        method: "POST",
        body: { sufijo, incluirFragmentos },
      }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "voltac-innovacion", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = TOOLS.find((t) => t.name === request.params.name);
  if (!tool) {
    return {
      isError: true,
      content: [{ type: "text", text: `Herramienta desconocida: ${request.params.name}` }],
    };
  }

  try {
    const result = await tool.run(request.params.arguments ?? {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: "text", text: e.message }] };
  }
});

await server.connect(new StdioServerTransport());
