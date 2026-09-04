"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { guardarClaveOpenRouter, borrarClaveOpenRouter } from "@/app/actions/projects";

/**
 * Clave de OpenRouter de la persona que ha iniciado sesion.
 *
 * El campo se vacia en cuanto se guarda y la clave no vuelve nunca del
 * servidor: lo unico que se muestra despues son los ultimos cuatro caracteres,
 * suficiente para reconocer cual es e inutil para usarla.
 *
 * `autoComplete="off"` y `spellCheck={false}` no son adorno: evitan que el
 * gestor de contraseñas del navegador la guarde como si fuera una credencial
 * del sitio, y que el corrector la mande a un servicio de terceros.
 */
export function ClaveOpenRouter({
  estado,
}: {
  estado: {
    tieneClavePropia: boolean;
    claveIlegible: boolean;
    pista: string;
    puedeUsarInstancia: boolean;
    hayClaveDeInstancia: boolean;
    puedeCorrer: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [valor, setValor] = useState("");

  const usandoInstancia =
    !estado.tieneClavePropia && estado.puedeUsarInstancia && estado.hayClaveDeInstancia;

  return (
    <div className="panel flex flex-col gap-5">
      <div>
        <h2 className="kicker mb-2">Tu clave de OpenRouter</h2>
        <p className="hint max-w-[66ch]">
          El agente investigador y el de Combinar corren con la clave de quien los lanza, asi que
          cada persona gasta sus propios creditos. La clave se guarda cifrada y no vuelve a salir
          del servidor: aqui solo veras sus ultimos caracteres.
        </p>
      </div>

      {/* ── Estado actual ─────────────────────────────────────────────────── */}
      <div
        className={`rounded-[4px] border p-3.5 ${
          estado.claveIlegible
            ? "border-[rgba(201,169,78,0.45)] bg-[rgba(201,169,78,0.07)]"
            : estado.puedeCorrer
              ? "border-[rgba(111,191,178,0.4)] bg-[rgba(111,191,178,0.06)]"
              : "border-[rgba(232,227,216,0.16)]"
        }`}
      >
        {estado.claveIlegible ? (
          <p className="text-[12.5px] leading-snug text-[#c9a94e]">
            Tienes una clave guardada pero el servidor ya no puede leerla: su secreto cambio
            desde que la guardaste. Vuelve a pegarla aqui abajo.
          </p>
        ) : estado.tieneClavePropia ? (
          <p className="text-[12.5px] leading-snug text-[#cbd4d2]">
            Clave propia guardada{" "}
            <code className="font-mono text-[11.5px] text-accent">{estado.pista}</code>. El
            agente corre con ella y el gasto va a tu cuenta de OpenRouter.
          </p>
        ) : usandoInstancia ? (
          <p className="text-[12.5px] leading-snug text-[#cbd4d2]">
            Estas usando la clave del servidor, porque tienes permiso para hacerlo. Si pones una
            propia, pasara a usarse la tuya.
          </p>
        ) : (
          /* Dos motivos distintos para no poder correr, y conviene separarlos:
             culpar al permiso cuando lo que falta es la clave del servidor
             manda a la persona a pedirle algo al administrador que no lo
             arreglaria. */
          <p className="text-[12.5px] leading-snug text-[#a9b5b3]">
            {estado.puedeUsarInstancia && !estado.hayClaveDeInstancia
              ? "Tienes permiso para usar la clave del servidor, pero el servidor no tiene ninguna configurada. Pon la tuya aqui, o pide que se anada OPENROUTER_API_KEY al entorno."
              : "No tienes clave propia y no tienes permiso para usar la del servidor, asi que el agente no correra."}{" "}
            Puedes crear una en{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent underline"
            >
              openrouter.ai/keys
            </a>
            .
          </p>
        )}
      </div>

      {/* ── Poner o cambiar ───────────────────────────────────────────────── */}
      <form
        action={(fd) => {
          setError(null);
          setGuardado(false);
          startTransition(async () => {
            try {
              await guardarClaveOpenRouter(fd);
              setValor("");
              setGuardado(true);
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo guardar la clave.");
            }
          });
        }}
        className="flex flex-col gap-3"
      >
        <div>
          <label className="label" htmlFor="clave">
            {estado.tieneClavePropia ? "Reemplazar la clave" : "Pegar tu clave"}
          </label>
          <input
            id="clave"
            name="clave"
            type="password"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              setError(null);
            }}
            placeholder="sk-or-v1-…"
            autoComplete="off"
            spellCheck={false}
            className="field font-mono text-[12px]"
          />
        </div>

        {error && <p className="text-[12px] text-[#e8a99c]">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="btn btn-primary disabled:opacity-40"
            disabled={pending || !valor.trim()}
          >
            {pending ? "Guardando…" : "Guardar la clave"}
          </button>

          {estado.tieneClavePropia && (
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await borrarClaveOpenRouter();
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "No se pudo borrar.");
                  }
                })
              }
            >
              Borrar la guardada
            </button>
          )}

          {guardado && !pending && (
            <span className="font-mono text-[10.5px] text-accent">guardada</span>
          )}
        </div>
      </form>
    </div>
  );
}
