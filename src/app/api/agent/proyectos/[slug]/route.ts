import { withToken } from "@/lib/agentRoute";
import { getProjectContext, type SeccionContexto } from "@/lib/agentApi";

/**
 * GET /api/agent/proyectos/[slug]?incluir=brief,fragmentos&detalle=resumen
 *
 * Contexto del proyecto, con las secciones que se pidan. Los parametros van en
 * la URL y no en el cuerpo porque esto es un GET y tiene que poder cachearse y
 * probarse con un navegador.
 */
const VALIDAS: SeccionContexto[] = [
  "brief",
  "plantilla",
  "celdas",
  "preguntas",
  "fragmentos",
  "insights",
];

export const GET = withToken(async (user, _identity, request) => {
  const url = new URL(request.url);
  const slug = decodeURIComponent(url.pathname.split("/").pop()!);

  const pedidas = (url.searchParams.get("incluir") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SeccionContexto => (VALIDAS as string[]).includes(s));

  const detalle = url.searchParams.get("detalle") === "completo" ? "completo" : "resumen";

  return getProjectContext(user, slug, {
    incluir: pedidas.length ? pedidas : undefined,
    detalle,
  });
});
