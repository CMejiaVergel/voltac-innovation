import { estadoDeClave } from "@/lib/agent/openrouter";
import type { Consumo } from "@/lib/consumoAgente";

/**
 * Panel de consumo del agente.
 *
 * Responde las dos preguntas que uno se hace antes de lanzar una corrida:
 * "¿me alcanza el saldo?" y "¿que me esta saliendo caro?". La primera la
 * contesta OpenRouter; la segunda solo la puede contestar la plataforma,
 * porque en OpenRouter todo el trafico de la aplicacion se ve igual.
 *
 * Es un componente de servidor: la clave se usa para consultar y no llega
 * nunca al navegador.
 */
export async function ConsumoAgente({
  apiKey,
  consumo,
  origen,
}: {
  apiKey: string | null;
  consumo: Consumo;
  origen: "PROPIA" | "INSTANCIA" | null;
}) {
  let estado: Awaited<ReturnType<typeof estadoDeClave>> | null = null;
  let fallo: string | null = null;

  if (apiKey) {
    try {
      estado = await estadoDeClave(apiKey);
    } catch (e) {
      fallo = e instanceof Error ? e.message : "No se pudo consultar el saldo.";
    }
  }

  return (
    <div className="panel flex flex-col gap-5">
      <div>
        <h2 className="kicker mb-2">Consumo del agente</h2>
        <p className="hint max-w-[66ch]">
          El saldo lo reporta OpenRouter; el desglose por modelo sale de las corridas hechas
          desde aqui. Sirve para decidir antes de lanzar: si un modelo esta saliendo caro,
          cambiarlo cuesta un clic en la pestaña del agente.
        </p>
      </div>

      {/* ── Saldo, de OpenRouter ──────────────────────────────────────────── */}
      {!apiKey ? (
        <p className="text-[12.5px] text-[#7d8a88]">
          Sin clave configurada no hay saldo que consultar.
        </p>
      ) : fallo ? (
        <p className="rounded-[4px] border border-[rgba(201,169,78,0.45)] bg-[rgba(201,169,78,0.07)] p-3 text-[12.5px] leading-snug text-[#c9a94e]">
          {fallo}
        </p>
      ) : estado ? (
        <div className="grid gap-[1px] overflow-hidden rounded-[4px] border border-[rgba(232,227,216,0.14)] bg-[rgba(232,227,216,0.14)] sm:grid-cols-3">
          <Dato
            titulo="Saldo de la cuenta"
            valor={estado.cuenta ? usd(estado.cuenta.saldo) : "—"}
            nota={
              estado.cuenta
                ? `${usd(estado.cuenta.comprado)} comprados · ${usd(estado.cuenta.gastado)} gastados`
                : "Esta clave no puede leer el credito de la cuenta"
            }
            alerta={Boolean(estado.cuenta && estado.cuenta.saldo < 1)}
          />
          <Dato
            titulo="Gastado con esta clave"
            valor={usd(estado.gastado)}
            nota={
              estado.tope === null
                ? "Sin tope propio: gasta contra el saldo de la cuenta"
                : `Tope ${usd(estado.tope)} · quedan ${usd(estado.restante ?? 0)}`
            }
            alerta={estado.restante !== null && estado.restante < 1}
          />
          <Dato
            titulo="Gastado desde aqui"
            valor={usd(consumo.total)}
            nota={`${consumo.corridas} corrida${consumo.corridas === 1 ? "" : "s"} · ${usd(consumo.ultimos30)} en 30 dias`}
          />
        </div>
      ) : null}

      {origen === "INSTANCIA" && (
        <p className="text-[11.5px] leading-snug text-[#c9a94e]">
          Estas cifras son de la clave del servidor, no de una tuya: el gasto va a la cuenta de
          quien monto la instancia.
        </p>
      )}

      {/* ── Desglose por modelo, de la plataforma ─────────────────────────── */}
      {consumo.modelos.length > 0 && (
        <div>
          <h3 className="kicker mb-2">En que se fue</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-[rgba(232,227,216,0.16)] text-left font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5e7370]">
                  <th className="pb-1.5 pr-3 font-normal">Modelo</th>
                  <th className="pb-1.5 pr-3 text-right font-normal">Corridas</th>
                  <th className="pb-1.5 pr-3 text-right font-normal">Tokens</th>
                  <th className="pb-1.5 pr-3 text-right font-normal">Busquedas</th>
                  <th className="pb-1.5 text-right font-normal">Costo</th>
                </tr>
              </thead>
              <tbody className="text-[#a9b5b3] [font-variant-numeric:tabular-nums]">
                {consumo.modelos.map((m) => (
                  <tr key={m.modelo} className="border-b border-[rgba(232,227,216,0.07)]">
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-[#cbd4d2]">
                      {m.modelo}
                    </td>
                    <td className="py-1.5 pr-3 text-right">{m.corridas}</td>
                    <td className="py-1.5 pr-3 text-right">{miles(m.tokens)}</td>
                    <td className="py-1.5 pr-3 text-right">{m.busquedas || "—"}</td>
                    <td className="py-1.5 text-right text-[#e8e3d8]">
                      {usd(m.costo)}
                      {m.sinCosto > 0 && (
                        <span
                          title={`${m.sinCosto} corrida(s) sin coste reportado por OpenRouter`}
                          className="ml-1 text-[#c9a94e]"
                        >
                          +
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Los totales locales son un piso, no la cifra exacta. Decirlo es
              mas util que fingir precision sobre dinero. */}
          <p className="mt-2 text-[11px] leading-snug text-[#5e7370]">
            {consumo.corridasSinCosto > 0 && (
              <>
                {consumo.corridasSinCosto} corrida
                {consumo.corridasSinCosto === 1 ? "" : "s"} sin coste reportado (marcadas con
                <span className="text-[#c9a94e]"> + </span>).{" "}
              </>
            )}
            Las corridas de Combinar todavia no registran su costo, asi que el total de aqui es
            un minimo. El saldo de arriba, que viene de OpenRouter, si lo incluye todo.
          </p>
        </div>
      )}

      {/* ── Ultimas corridas ──────────────────────────────────────────────── */}
      {consumo.recientes.length > 0 && (
        <div>
          <h3 className="kicker mb-2">Ultimas corridas</h3>
          <ul className="flex flex-col gap-1">
            {consumo.recientes.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-[rgba(232,227,216,0.07)] py-1.5 text-[11.5px]"
              >
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.1em]"
                  style={{ color: r.estado === "ERROR" ? "#c98b7a" : "#5e7370" }}
                >
                  {r.estado === "ERROR" ? "fallo" : r.estado.toLowerCase()}
                </span>
                <span className="text-[#cbd4d2]">{r.proyecto}</span>
                <span className="font-mono text-[10px] text-[#5e7370]">{r.modelo}</span>
                <span className="flex-1" />
                <span className="font-mono text-[10px] text-[#7d8a88] [font-variant-numeric:tabular-nums]">
                  {r.fragmentos} frag · {miles(r.tokens)} tok
                  {r.busquedas > 0 && ` · ${r.busquedas} web`}
                </span>
                <span className="w-[64px] text-right font-mono text-[10.5px] text-[#e8e3d8] [font-variant-numeric:tabular-nums]">
                  {r.costo === null ? "—" : usd(r.costo)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {consumo.corridas === 0 && (
        <p className="text-[12.5px] text-[#7d8a88]">
          Todavia no has lanzado ninguna corrida del agente.
        </p>
      )}
    </div>
  );
}

function Dato({
  titulo,
  valor,
  nota,
  alerta,
}: {
  titulo: string;
  valor: string;
  nota: string;
  alerta?: boolean;
}) {
  return (
    <div className="bg-panel p-3.5">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[#5e7370]">
        {titulo}
      </p>
      <p
        className="mt-1 text-[20px] font-semibold leading-none [font-variant-numeric:tabular-nums]"
        style={{ color: alerta ? "#c9a94e" : "#e8e3d8" }}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-[10.5px] leading-snug text-[#7d8a88]">{nota}</p>
    </div>
  );
}

/** Cuatro decimales: una corrida barata cuesta centesimas y "0.00" no informa. */
function usd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function miles(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
