import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { listOrgsFor } from "@/lib/organizaciones";
import { crearOrganizacion } from "@/app/actions/organizaciones";
import { Avisos, Campo } from "@/components/v2/ui";

export const metadata = { title: "Organizaciones — Voltac Innovacion" };

export default async function OrganizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ hecho?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { hecho, error } = await searchParams;
  const orgs = await listOrgsFor(user);

  return (
    <div className="pt-8 pb-16">
      <h1 className="text-[32px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">Organizaciones</h1>
      <p className="hint mt-3">El proceso empieza en la organización donde se quiere innovar.</p>

      <div className="mt-6">
        <Avisos hecho={hecho} error={error} />
      </div>

      {orgs.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/organizaciones/${o.slug}`}
                className="panel block h-full transition hover:border-[rgba(111,191,178,0.5)]"
              >
                {o.sector && <p className="kicker mb-2">{o.sector}</p>}
                <h2 className="text-[17px] font-semibold leading-tight text-[#e8e3d8]">{o.name}</h2>
                {o.descripcion && <p className="mt-1.5 line-clamp-2 text-[12px] text-[#8b9a97]">{o.descripcion}</p>}
                <div className="mt-4 flex gap-4 font-mono text-[10.5px] text-[#5e7370]">
                  
                  <span>{o._count.desafios} desafíos</span>
                  <span>{o._count.proyectos} retos</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <form action={crearOrganizacion} className="panel mt-8 flex max-w-[720px] flex-col gap-4">
        <h2 className="kicker">Nueva organización</h2>
        <Campo name="name" label="Nombre" rows={1} placeholder="Ej. Cabot Cartagena" required />
        <Campo name="sector" label="Sector" rows={1} placeholder="Ej. Química · negro de humo" />
        <Campo name="descripcion" label="Descripción breve" rows={2} placeholder="Qué hace, dónde opera, cuál es su tamaño." />
        <div>
          <button type="submit" className="btn btn-primary">
            Crear y continuar
          </button>
        </div>
      </form>
    </div>
  );
}
