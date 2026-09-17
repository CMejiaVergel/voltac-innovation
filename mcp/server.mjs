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
    name: "crear_proyecto",
    description:
      "Abre un proyecto de innovacion nuevo, con su brief y su mapa vacio. Solo se escribe el reto LITERAL tal como lo entrego la empresa, sin reinterpretarlo. El resto de la etapa Configurar —meta, restricciones y sobre todo el «que evitar»— lo escribe el equipo con la empresa delante: son los campos que despues limitan lo que se puede proponer, y rellenarlos por tu cuenta inventa restricciones que nadie fijo. Devuelve el slug.",
    inputSchema: {
      type: "object",
      properties: {
        nombre: {
          type: "string",
          description:
            "Como se va a llamar el proyecto. Que diga de que va el reto, no solo el nombre de la empresa.",
        },
        empresa: { type: "string", description: "La compañia que plantea el reto." },
        programa: { type: "string", description: "El programa o convocatoria, si lo hay." },
        reto: {
          type: "string",
          description: "El reto tal como lo escribio la empresa. Cita literal, sin reformular.",
        },
        plantilla: {
          type: "string",
          description:
            "Clave de la plantilla del mapa. Por defecto 'gimi-5x5', que es la del taller.",
        },
      },
      required: ["nombre"],
    },
    run: (body) => api("/api/agent/proyectos", { method: "POST", body }),
  },
  {
    name: "renombrar_proyecto",
    description:
      "Cambia el nombre, la empresa o el programa de un proyecto. El slug NO cambia: los enlaces guardados, los respaldos y las corridas registradas siguen valiendo.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        nombre: { type: "string" },
        empresa: { type: "string" },
        programa: { type: "string" },
      },
      required: ["slug"],
    },
    run: ({ slug, ...body }) =>
      api(`${slugPath(slug)}/renombrar`, { method: "POST", body }),
  },
  {
    name: "leer_proyecto",
    description:
      "Contexto del proyecto. Trae SOLO las secciones que pidas: cada llamada completa cuesta decenas de miles de tokens y agota la sesion en pocas lecturas. Por defecto vienen brief, plantilla, celdas y fragmentos en modo resumen, que es lo que hace falta para proponer. Pide 'preguntas' o 'insights' solo si los vas a tocar, y detalle 'completo' solo al revisar propuestas (añade verificacion, fuentes y porQueAqui). Devuelve una 'firma': si no cambio desde tu ultima lectura, el contexto que ya tienes sirve y no hace falta releer.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Slug del proyecto." },
        incluir: {
          type: "array",
          items: {
            type: "string",
            enum: ["brief", "plantilla", "celdas", "preguntas", "fragmentos", "insights", "conceptos", "artefactos"],
          },
          description:
            "Secciones a traer. Vacio = brief, plantilla, celdas y fragmentos. Para armar conceptos pide insights en detalle completo: ahi vienen las ideas con su id.",
        },
        detalle: {
          type: "string",
          enum: ["resumen", "completo"],
          description:
            "resumen (por defecto) trae lo indispensable. completo añade verificacion, fuentes, porQueAqui y el desglose entero de los insights; pesa unas tres veces mas.",
        },
      },
      required: ["slug"],
    },
    run: ({ slug, incluir, detalle }) => {
      const q = new URLSearchParams();
      if (incluir?.length) q.set("incluir", incluir.join(","));
      if (detalle) q.set("detalle", detalle);
      const cola = q.toString();
      return api(`${slugPath(slug)}${cola ? `?${cola}` : ""}`);
    },
  },
  {
    name: "estado_proyecto",
    description:
      "La lectura BARATA: conteos, celdas con menos de tres fragmentos, cuantos quedan sin clasificar y una firma del estado. Unas pocas lineas. Empieza SIEMPRE por aqui: si la firma coincide con la de tu ultima lectura, no hace falta volver a leer el proyecto.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
    run: ({ slug }) => api(`${slugPath(slug)}/estado`),
  },
  {
    name: "proponer_fragmentos",
    description:
      "Agrega fragmentos al Mapa de Oportunidades. Un fragmento es UNA observacion cruda de maximo 25 palabras, con sujeto nombrado y cifras con unidad y año, sin conclusiones ni insights. PROHIBIDO: concluir ('el patron es', 'la oportunidad es'), relacionar fragmentos entre si, inventar cifras, rellenar por cuota, repetir lo que ya esta, cuestionar una restriccion que la empresa fijo por escrito, ser mas especifico que la fuente (si dice 'varias' no escribas 'cuatro'), y afirmar lo que dice un documento sin haberlo abierto. Lo que responde la propia empresa SI es fuente valida: va como VERIFIED con fuenteCita nombrando la ocasion. Por defecto entran como PROPOSED y esperan revision humana. El servidor rechaza duplicados y celdas que no existen, y degrada a 'por confirmar' cualquier VERIFIED que llegue sin fuenteUrl ni fuenteCita.",
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
              items: {
                type: "array",
                items: { type: "integer" },
                description:
                  "Indices de los items de esa fila a los que pertenece el fragmento; leer_proyecto los lista en plantilla.filas[].items. Un fragmento casi siempre habla de una faceta concreta —'el cliente exige acreditacion' es Clientes, no Mercado en general—. Puede llevar varios, o ninguno si de verdad no encaja. No inventes indices.",
              },
              verificacion: {
                type: "string",
                enum: ["VERIFIED", "TO_CONFIRM", "ASSUMPTION"],
                description:
                  "VERIFIED exige fuenteUrl real consultada en esta sesion, o fuenteCita con el documento concreto. Si dudas, TO_CONFIRM.",
              },
              fuenteUrl: { type: "string" },
              fuenteCita: {
                type: "string",
                description:
                  "Titulo del documento. Tambien sirve para lo que respondio la propia empresa, que es fuente de primera mano: 'Sesion de preguntas y respuestas con la empresa, 5 de septiembre de 2026'.",
              },
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
      "Corrige un fragmento existente: su texto, la celda donde vive, su estado de verificacion o su fuente. Util para reubicar fragmentos mal colocados. Y obligatorio cuando la empresa responde algo que contradice lo que ya esta escrito: se corrige el fragmento viejo, no se añade uno nuevo al lado — dos fragmentos que se contradicen dejan al equipo eligiendo a ciegas.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        texto: { type: "string" },
        fila: { type: "string" },
        columna: { type: "string" },
        items: {
          type: "array",
          items: { type: "integer" },
          description:
            "Indices de los items de la fila. Sirve para clasificar fragmentos que ya estan escritos sin tocar su texto.",
        },
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
    name: "clasificar_fragmentos",
    description:
      "Marca EN LOTE a que items de su fila pertenece cada fragmento. Es la forma de clasificar un mapa ya escrito: hacerlo con editar_fragmento serian cien llamadas. No toca el texto ni la celda de nada, solo los items, asi que es seguro pasarlo sobre un mapa revisado. Los indices de cada fila salen de leer_proyecto en plantilla.filas[].items. Un id que no sea del proyecto se rechaza con su motivo sin tumbar el resto del lote.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        fragmentos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "id de fragmento de leer_proyecto." },
              items: {
                type: "array",
                items: { type: "integer" },
                description:
                  "Indices de los items de SU fila. Vacio si de verdad no encaja en ninguna; no fuerces.",
              },
            },
            required: ["id", "items"],
          },
        },
      },
      required: ["slug", "fragmentos"],
    },
    run: ({ slug, fragmentos }) =>
      api(`${slugPath(slug)}/clasificar`, { method: "POST", body: { fragmentos } }),
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
    name: "proponer_insights",
    description:
      "Etapa COMBINAR. Crea insights conectando puntos (fragmentos) del mapa. ANATOMIA OBLIGATORIA, en este orden: PATRON (una regularidad dificilmente cuestionable, escrita en general: si alguien puede decir 'eso depende', no es un patron) -> HECHO (el dato del mapa que demuestra que ese patron se cumple en este reto, con cifra y actor) -> IMPLICACION (el '¿y que?': lo que cambia al leer los dos juntos y que ninguno decia solo). Y un EXAMEN que decide si se queda: la implicacion tiene que abrir una OPORTUNIDAD DE NEGOCIO NUEVA. Un insight que solo reafirma la importancia del reto se descarta — la empresa ya sabe que su reto importa, por eso lo planteo. Prohibido afirmar disposicion ('estarian dispuestos a'): solo vale lo que ya hicieron y consta en un fragmento. Prohibido contradecir lo que la empresa fijo en el brief. Prohibido adelantarse a la solucion: el insight revela, no diseña. Lee la skill combinar.md antes. Los ids de los puntos salen de leer_proyecto. Por defecto entran como PROPOSED para que una persona los revise.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        estado: {
          type: "string",
          enum: ["PROPOSED", "ACCEPTED"],
          description:
            "PROPOSED (por defecto) deja el insight en revision. ACCEPTED solo si la persona lo pidio.",
        },
        insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              enunciado: {
                type: "string",
                description:
                  "El parrafo completo: patron, hecho e implicacion seguidos. Tiene que leerse solo, sin el desglose, y en tercera persona — lo va a leer gente que no estuvo en la conversacion.",
              },
              puntos: {
                type: "array",
                description: "Minimo 2, recomendado 3. En el orden del recorrido.",
                items: {
                  type: "object",
                  properties: {
                    fragmentoId: { type: "string", description: "id de fragmento de leer_proyecto." },
                    papel: {
                      type: "string",
                      enum: ["PATRON", "HECHO", "APERTURA", "APOYO"],
                      description:
                        "PATRON: muestra que la regularidad se repite. HECHO: aporta el dato duro; sin ninguno el insight no se sostiene. APERTURA: el punto por el que asoma la oportunidad, casi siempre una adyacencia. APOYO: matiza o acota.",
                    },
                  },
                  required: ["fragmentoId"],
                },
              },
              etiqueta: { type: "string", description: "Nombre corto, ej. 'Calor'." },
              color: {
                type: "string",
                description:
                  "Color del trazo en el mapa, en #rrggbb. Omitelo para que use el de la paleta segun su posicion.",
              },
              patron: {
                type: "string",
                description:
                  "1. La regularidad dificilmente cuestionable, en general y sin nombrar todavia a la empresa. Es la unica pieza que puede no salir de un fragmento, porque es conocimiento comun — pero entonces tiene que ser de verdad incuestionable.",
              },
              hecho: {
                type: "string",
                description:
                  "2. El dato del mapa que demuestra que el patron se cumple en este reto. Con cifra y actor nombrado. Si no puedes señalar el punto del que sale, no lo escribas.",
              },
              implicacion: {
                type: "string",
                description:
                  "3. El «¿y que?». Casi siempre un desplazamiento: el problema no esta donde se buscaba, o el candidato no es el que parecia. Si se puede sustituir por el hecho sin perder nada, es una glosa.",
              },
              oportunidad: {
                type: "string",
                description:
                  "El negocio nuevo que abre la implicacion. Es el examen que decide si el insight vale: si lo unico que abre es «hay que resolver el reto», descartalo y dilo.",
              },
              limite: { type: "string", description: "Que NO se puede afirmar con estos puntos. Obligatorio en la practica." },
              ideas: { type: "array", items: { type: "string" } },
            },
            required: ["enunciado", "puntos"],
          },
        },
        orden: {
          type: "array",
          items: { type: "string" },
          description: "Opcional: ids de insight en el orden final del tablero.",
        },
      },
      required: ["slug"],
    },
    run: ({ slug, ...body }) =>
      api(`${slugPath(slug)}/insights`, { method: "POST", body }),
  },
  {
    name: "editar_insight",
    description:
      "Corrige un insight existente: su frase, su desglose, sus puntos o sus ideas. Los 'puntos' se reemplazan enteros. Las 'ideas' NO: pasa cada idea existente con su id para editarla en su sitio, porque los conceptos de Convergir apuntan a ellas; una idea sin id se crea, y una existente que no envies se borra y deja huerfano al concepto que salia de ella. Los ids vienen en leer_proyecto con insights en detalle completo. Usalo en vez de crear uno nuevo cuando el insight ya existe pero esta mal planteado.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        enunciado: { type: "string" },
        etiqueta: { type: "string" },
        color: { type: "string", description: "Color del trazo en #rrggbb." },
        patron: { type: "string", description: "1. La regularidad dificilmente cuestionable." },
        hecho: { type: "string", description: "2. El dato del mapa que la demuestra aqui." },
        implicacion: { type: "string", description: "3. El «¿y que?»." },
        oportunidad: { type: "string", description: "El negocio nuevo que abre." },
        limite: { type: "string", description: "Hasta donde llega la evidencia." },
        estado: { type: "string", enum: ["ACCEPTED", "PROPOSED", "REJECTED"] },
        puntos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fragmentoId: { type: "string" },
              papel: { type: "string", enum: ["PATRON", "HECHO", "APERTURA", "APOYO"] },
            },
            required: ["fragmentoId"],
          },
        },
        ofreceQuien: { type: "string" },
        ofrecePrueba: { type: "string" },
        pagaQuien: { type: "string" },
        pagaPrueba: { type: "string" },
        ideas: {
          type: "array",
          items: {
            anyOf: [
              { type: "string", description: "Idea nueva." },
              {
                type: "object",
                properties: { id: { type: "string" }, texto: { type: "string" } },
                required: ["texto"],
              },
            ],
          },
        },
      },
      required: ["id"],
    },
    run: ({ id, ...patch }) =>
      api(`/api/agent/insights/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
  },
  {
    name: "eliminar_insight",
    description:
      "Borra un insight y sus conexiones. Los fragmentos del mapa NO se tocan: un insight apunta a ellos, no los contiene.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    run: ({ id }) =>
      api(`/api/agent/insights/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  {
    name: "proponer_conceptos",
    description:
      "Etapa CONVERGIR. Crea conceptos de solucion a partir de ideas de Combinar. Un concepto puede juntar ideas de VARIOS insights compatibles: asi se escala una solucion mas alla de lo que cada insight abria solo. Se describe con los cinco elementos de la plantilla del GIMI: quien tiene el problema, que necesita, cual es la solucion, quien la ofrece y como lo resolvera, mas el ancla en el mapa. Cada concepto declara sus supuestos: lo que tendria que ser cierto para que funcione, con probabilidad de 1 (muy improbable) a 5; lo improbable es el trabajo que queda. Los limites declarados en los insights suelen ser los mejores supuestos. NO puntues la matriz Impacto x Fit: es un ejercicio del equipo. No contradigas las restricciones del brief ni lo que afirma otro insight. COMPLETITUD: un concepto de negocio esta completo solo si recorre las cinco dimensiones del mapa —mercado, entrega, oferta, produccion y modelos de negocio— con al menos un fragmento ACEPTADO en cada una; puede usar varios. Pasalos en 'fragmentos'. Si el mapa no tiene fragmento que lo sostenga en una dimension, investiga o reformula el concepto: no lo rellenes. La respuesta devuelve las dimensiones que faltan. La meta del GIMI es de 4 a 5 conceptos. Los ids de las ideas salen de leer_proyecto con insights en detalle completo. Entran como PROPOSED.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        estado: { type: "string", enum: ["PROPOSED", "ACCEPTED"] },
        conceptos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "Nombre corto, para poder señalarlo en una discusion." },
              enunciado: { type: "string", description: "Que es, en una frase." },
              quienTieneElProblema: { type: "string" },
              necesidades: { type: "string" },
              solucion: { type: "string" },
              quienLaOfrece: { type: "string" },
              comoLoResuelve: { type: "string", description: "Aliados, modelo de negocio y activos." },
              ancla: { type: "string", description: "El punto caliente del mapa del que parte." },
              ideas: {
                type: "array",
                items: { type: "string" },
                description: "Ids de ideas de Combinar. Minimo una.",
              },
              fragmentos: {
                type: "array",
                items: { type: "string" },
                description:
                  "Ids de fragmentos aceptados del mapa que sostienen el concepto. Al menos uno por cada una de las cinco dimensiones.",
              },
              supuestos: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    texto: { type: "string" },
                    probabilidad: { type: "integer", minimum: 1, maximum: 5 },
                  },
                  required: ["texto"],
                },
              },
            },
            required: ["titulo", "enunciado", "ideas"],
          },
        },
      },
      required: ["slug", "conceptos"],
    },
    run: ({ slug, ...body }) =>
      api(`${slugPath(slug)}/conceptos`, { method: "POST", body }),
  },
  {
    name: "proponer_artefacto",
    description:
      "Etapa ACTUAR. Crea un artefacto de innovacion: la representacion visual de un concepto de solucion (landing, one-pager, folleto) para que la empresa reaccione antes del MVP. Cuelga de un concepto, que puede juntar varios insights. Vende la idea, pero EXPONE sus supuestos mas debiles: pasa los ids de los supuestos del concepto que pone a la vista, empezando por los de menor probabilidad. Cada cifra que muestre el documento se declara aqui: META (lo que se propone lograr), ESTIMACION (calculo o referente, con su base) o HECHO (exige fragmentoId del mapa; sin el se guarda como estimacion). Prohibido presentar el concepto como producto existente (nada de login ni ingresar) y mostrar porcentajes de impacto como medidos. El llamado a la accion invita a reaccionar, no a comprar. El documento HTML no viaja por aqui: se carga en el servidor con npm run artefacto:cargar.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        concepto: { type: "string", description: "Id del concepto de Convergir." },
        titulo: { type: "string" },
        formato: { type: "string", enum: ["LANDING", "ONE_PAGER", "FOLLETO", "OTRO"] },
        promesa: { type: "string", description: "Lo que la empresa tiene que entender al verlo, en una frase." },
        supuestos: { type: "array", items: { type: "string" }, description: "Ids de supuestos del concepto." },
        cifras: {
          type: "array",
          items: {
            type: "object",
            properties: {
              valor: { type: "string", description: "Tal como aparece en el documento, ej. 94%." },
              etiqueta: { type: "string", description: "Que mide." },
              tipo: { type: "string", enum: ["META", "ESTIMACION", "HECHO"] },
              base: { type: "string", description: "De donde sale. Obligatorio en la practica para ESTIMACION." },
              fragmentoId: { type: "string", description: "Fragmento del mapa. Obligatorio para HECHO." },
            },
            required: ["valor", "etiqueta"],
          },
        },
      },
      required: ["slug", "concepto", "titulo"],
    },
    run: ({ slug, ...body }) => api(`${slugPath(slug)}/artefactos`, { method: "POST", body }),
  },
  {
    name: "editar_artefacto",
    description:
      "Corrige el nombre, la promesa, el formato o el estado de un artefacto (BORRADOR, LISTO, PRESENTADO). Al pasar a PRESENTADO se fecha solo. Las cifras y los supuestos expuestos no se tocan aqui, y el documento se vuelve a cargar con npm run artefacto:cargar.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        titulo: { type: "string" },
        promesa: { type: "string" },
        formato: { type: "string", enum: ["LANDING", "ONE_PAGER", "FOLLETO", "OTRO"] },
        estado: { type: "string", enum: ["BORRADOR", "LISTO", "PRESENTADO"] },
        presentadoA: { type: "string" },
      },
      required: ["id"],
    },
    run: ({ id, ...body }) =>
      api(`/api/agent/artefactos/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  },
  {
    name: "editar_concepto",
    description:
      "Corrige un concepto de Convergir o puntua su matriz Impacto x Fit. Puntua SOLO si el equipo lo pidio: es su ejercicio. Escala 1 a 5, 0 deja el subcriterio sin puntuar. Impacto: demanda (tiene mas demanda), implementar (facil de implementar), escalar (facil de escalar). Fit: resuelveProblema, atractivoEquipo, metas (ayuda a alcanzar las metas del reto). Siempre con justificacion: el porque de cada numero, anclado en fragmentos, insights o supuestos. Un numero sin porque no se puede discutir.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        titulo: { type: "string" },
        enunciado: { type: "string" },
        estado: { type: "string", enum: ["ACCEPTED", "PROPOSED", "REJECTED"] },
        puntuacion: {
          type: "object",
          properties: {
            demanda: { type: "integer", minimum: 0, maximum: 5 },
            implementar: { type: "integer", minimum: 0, maximum: 5 },
            escalar: { type: "integer", minimum: 0, maximum: 5 },
            resuelveProblema: { type: "integer", minimum: 0, maximum: 5 },
            atractivoEquipo: { type: "integer", minimum: 0, maximum: 5 },
            metas: { type: "integer", minimum: 0, maximum: 5 },
          },
        },
        justificacion: { type: "string" },
        fragmentos: {
          type: "array",
          items: { type: "string" },
          description: "Reemplaza los fragmentos que sostienen el concepto. Al menos uno por dimension.",
        },
        supuestosNuevos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              texto: { type: "string" },
              probabilidad: { type: "integer", minimum: 1, maximum: 5 },
            },
            required: ["texto"],
          },
          description: "Supuestos que se añaden al final; los existentes no se tocan.",
        },
        quienTieneElProblema: { type: "string", description: "Si envias uno de los cinco elementos, envia los cinco: la descripcion se recompone entera." },
        necesidades: { type: "string" },
        solucion: { type: "string" },
        quienLaOfrece: { type: "string" },
        comoLoResuelve: { type: "string" },
        ancla: { type: "string" },
      },
      required: ["id"],
    },
    run: ({ id, ...patch }) =>
      api(`/api/agent/conceptos/${encodeURIComponent(id)}`, { method: "PATCH", body: patch }),
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
