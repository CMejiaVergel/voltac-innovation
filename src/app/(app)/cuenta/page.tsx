import { requireUser } from "@/lib/auth";
import { estadoClaveAgente } from "@/lib/claveAgente";
import { ClaveOpenRouter } from "@/components/ClaveOpenRouter";

export const metadata = { title: "Tu cuenta — Voltac Innovacion" };

export default async function CuentaPage() {
  const user = await requireUser();
  const estado = await estadoClaveAgente(user.id);

  return (
    <div className="pt-8 pb-16">
      <p className="kicker mb-2">Tu cuenta</p>
      <h1 className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">
        {user.name}
      </h1>
      <p className="mt-2 font-mono text-[11.5px] text-[#7d8a88]">{user.email}</p>

      <div className="mt-8 max-w-[720px]">
        {estado && <ClaveOpenRouter estado={estado} />}
      </div>
    </div>
  );
}
