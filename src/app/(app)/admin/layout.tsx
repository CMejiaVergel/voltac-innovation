import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="max-w-[920px] pt-8">
      <p className="kicker mb-3">Administracion</p>
      <AdminTabs />
      {children}
    </div>
  );
}
