"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";

import { crearTokenMcp, type EstadoToken } from "@/app/actions/tokens";

const INICIAL: EstadoToken = { ok: false, mensaje: "" };

/** Genera un token para el MCP; pide la contraseña del superadmin y lo muestra una sola vez. */
export function FormTokenMcp({ proyectos }: { proyectos: { slug: string; name: string }[] }) {
  const [estado, despachar] = useActionState(crearTokenMcp, INICIAL);
  const [pending, start] = useTransition();
  const [copiado, setCopiado] = useState("");
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    // La contraseña no se queda escrita en el formulario.
    (form.elements.namedItem("clave") as HTMLInputElement).value = "";
    start(() => despachar(fd));
  };

  const config =
    estado.ok && estado.token
      ? JSON.stringify(
          {
            mcpServers: {
              "voltac-innovacion": {
                command: "node",
                args: ["mcp/server.mjs"],
                env: {
                  VOLTAC_API_URL: estado.url,
                  VOLTAC_API_TOKEN: estado.token,
                  ...(estado.proyecto ? { VOLTAC_PROYECTO: estado.proyecto } : {}),
                },
              },
            },
          },
          null,
          2,
        )
      : "";
  const copiar = (que: string, texto: string) => navigator.clipboard.writeText(texto).then(() => setCopiado(que));

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Para quién y para qué</span>
            <input name="etiqueta" required maxLength={80} className="field" placeholder="Ej. Nathalie · Claude Code en su portátil" />
          </label>
          <label className="block">
            <span className="label">Proyecto</span>
            <select name="proyecto" className="field" defaultValue={proyectos[0]?.slug ?? ""}>
              {proyectos.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
              <option value="">Todos los proyectos (no recomendado)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Vence en</span>
            <select name="dias" className="field" defaultValue="30">
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-[12.5px] text-[#c9d1cf]">
            <input type="checkbox" name="soloLectura" className="accent-[#6FBFB2]" />
            Solo lectura: puede consultar, no cambiar nada
          </label>
        </div>
        <label className="block sm:max-w-[50%]">
          <span className="label">Confirma tu contraseña</span>
          <input name="clave" type="password" required autoComplete="current-password" className="field" />
        </label>
        <div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Generando…" : "Generar token"}
          </button>
        </div>
      </form>

      {estado.mensaje && (
        <div
          role="status"
          className={`rounded-[4px] border p-3 text-[12.5px] leading-relaxed ${
            estado.ok ? "border-[rgba(111,191,178,0.45)] bg-[rgba(111,191,178,0.1)] text-accent" : "border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] text-[#e8a99c]"
          }`}
        >
          {estado.mensaje}
          {estado.token && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex gap-2">
                <input readOnly value={estado.token} className="field flex-1 font-mono text-[11px]" onFocus={(e) => e.target.select()} />
                <button type="button" className="btn" onClick={() => copiar("token", estado.token!)}>
                  {copiado === "token" ? "Copiado" : "Copiar token"}
                </button>
              </div>
              <div>
                <p className="mb-1 text-[#c9d1cf]">
                  Configuración para Claude Code (archivo <code>.mcp.json</code> en la carpeta del repositorio de la plataforma):
                </p>
                <pre className="overflow-x-auto rounded-[4px] bg-[rgba(0,0,0,0.3)] p-3 font-mono text-[11px] text-[#c9d1cf]">{config}</pre>
                <button type="button" className="btn mt-2" onClick={() => copiar("config", config)}>
                  {copiado === "config" ? "Copiado" : "Copiar configuración"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
