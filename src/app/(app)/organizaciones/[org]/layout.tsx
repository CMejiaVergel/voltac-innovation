import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrg } from "@/lib/organizaciones";
import { PROJECT_ROLE_LABEL } from "@/lib/enums";
import { HATS, IDEX } from "@/lib/gimi";
import { PasosConfigurar } from "@/components/v2/PasosConfigurar";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const user = await requireUser();
  const { org, role } = await requireOrg(user, slug);

  const [desafios, seleccionados, retos] = await Promise.all([
    prisma.desafioPropuesto.count({ where: { organizacionId: org.id } }),
    prisma.desafioPropuesto.count({ where: { organizacionId: org.id, estado: "SELECCIONADO" } }),
    prisma.project.count({ where: { organizacionId: org.id } }),
  ]);
  const p = org.perfil;
  const hechos = {
    perfil: Boolean(p?.definicion && p.brechaCuanto && (p.ejeNovedad || p.ejeGeografico)),
    desafios: desafios > 0,
    seleccion: seleccionados > 0,
    reto: retos > 0,
  };
  const setup = IDEX[0];

  return (
    <div className="pt-7 pb-24">
      <div className="no-print flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="kicker mb-2 flex items-center gap-2">
            <Link href="/organizaciones" className="hover:text-white">
              Organizaciones
            </Link>
            <span>·</span>
            Etapa 1 · {setup.name}
            <span className="flex gap-1">
              {setup.hats.map((h) => (
                <span
                  key={h}
                  title={`Sombrero ${HATS[h].name}: ${HATS[h].trait}`}
                  className="inline-block h-2.5 w-2.5 rounded-full border border-black/30"
                  style={{ background: HATS[h].color }}
                />
              ))}
            </span>
          </p>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#e8e3d8]">
            <Link href={`/organizaciones/${slug}`}>{org.name}</Link>
          </h1>
        </div>
        <div className="flex-1" />
        <Link href={`/organizaciones/${slug}/equipo`} className="btn">
          Equipo
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#5e7370]">
          Tu rol: {PROJECT_ROLE_LABEL[role]}
        </span>
      </div>

      <PasosConfigurar slug={slug} hechos={hechos} />

      {children}
    </div>
  );
}
