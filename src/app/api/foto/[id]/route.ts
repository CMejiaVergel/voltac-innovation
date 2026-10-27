import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { leerFoto, mimeDe } from "@/lib/fotos";

/** Foto de perfil. Solo la ven personas con sesión en la instancia. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSessionUser())) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const u = await prisma.user.findUnique({ where: { id }, select: { foto: true } });
  const datos = u?.foto ? await leerFoto(u.foto) : null;
  if (!u || !datos) return new Response("Sin foto", { status: 404 });
  return new Response(new Uint8Array(datos), {
    headers: {
      "Content-Type": mimeDe(u.foto),
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
