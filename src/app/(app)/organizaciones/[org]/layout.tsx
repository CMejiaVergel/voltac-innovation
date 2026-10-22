import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { requireOrg, avanceConfigurar } from "@/lib/organizaciones";
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
  const { org } = await requireOrg(user, slug);

  const hechos = await avanceConfigurar(org);

  return (
    <div className="pt-7 pb-24">
      <div className="no-print flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Link href="/organizaciones" className="kicker mb-1.5 inline-block hover:text-white">
            ← Organizaciones
          </Link>
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#e8e3d8]">
            <Link href={`/organizaciones/${slug}`}>{org.name}</Link>
          </h1>
        </div>
        <div className="flex-1" />
        <Link href={`/organizaciones/${slug}/equipo`} className="btn">
          Equipo
        </Link>
      </div>

      <PasosConfigurar slug={slug} hechos={hechos} />

      {children}
    </div>
  );
}
