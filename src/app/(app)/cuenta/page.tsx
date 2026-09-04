import { requireUser } from "@/lib/auth";
import { estadoClaveAgente, claveDelAgente } from "@/lib/claveAgente";
import { consumoDe } from "@/lib/consumoAgente";
import { ClaveOpenRouter } from "@/components/ClaveOpenRouter";
import { ConsumoAgente } from "@/components/ConsumoAgente";

export const metadata = { title: "Tu cuenta — Voltac Innovacion" };

// El saldo se consulta a OpenRouter en cada visita: una cifra de dinero
// cacheada es peor que no mostrarla.
export const dynamic = "force-dynamic";

export default async function CuentaPage() {
  const user = await requireUser();
  const estado = await estadoClaveAgente(user.id);
  const consumo = await consumoDe(user.id);

  // La clave se resuelve aqui, en el servidor, y solo viaja al componente que
  // consulta el saldo. No baja al navegador en ningun caso.
  let apiKey: string | null = null;
  let origen: "PROPIA" | "INSTANCIA" | null = null;
  try {
    const r = await claveDelAgente(user.id);
    apiKey = r.clave;
    origen = r.origen;
  } catch {
    // Sin clave utilizable. El panel de arriba ya explica por que.
  }

  return (
    <div className="pt-8 pb-16">
      <p className="kicker mb-2">Tu cuenta</p>
      <h1 className="text-[28px] font-bold leading-none tracking-[-0.02em] text-[#e8e3d8]">
        {user.name}
      </h1>
      <p className="mt-2 font-mono text-[11.5px] text-[#7d8a88]">{user.email}</p>

      <div className="mt-8 flex max-w-[820px] flex-col gap-6">
        {estado && <ClaveOpenRouter estado={estado} />}
        <ConsumoAgente apiKey={apiKey} consumo={consumo} origen={origen} />
      </div>
    </div>
  );
}
