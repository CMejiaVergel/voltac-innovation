import type { ReactNode } from "react";

/** Aviso que llega en la URL (?hecho= / ?error=) tras una acción. */
export function Avisos({ hecho, error }: { hecho?: string; error?: string }) {
  return (
    <>
      {hecho && (
        <p className="mb-5 rounded-[4px] border border-[rgba(111,191,178,0.45)] bg-[rgba(111,191,178,0.1)] p-3 text-[12.5px] leading-relaxed text-accent">
          {hecho}
        </p>
      )}
      {error && (
        <p className="mb-5 rounded-[4px] border border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] p-3 text-[12.5px] leading-relaxed text-[#e8a99c]">
          {error}
        </p>
      )}
    </>
  );
}

export function Campo({
  name,
  label,
  help,
  defaultValue,
  rows = 3,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  help?: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {rows <= 1 ? (
        <input name={name} defaultValue={defaultValue} placeholder={placeholder} required={required} className="field" />
      ) : (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={rows}
          placeholder={placeholder}
          required={required}
          className="field resize-y leading-relaxed"
        />
      )}
      {help && <span className="hint mt-1 block text-[11.5px]">{help}</span>}
    </label>
  );
}

/** Bloque numerado de un formulario, con su porqué metodológico a la vista. */
export function Bloque({
  n,
  titulo,
  porQue,
  children,
}: {
  n: string;
  titulo: string;
  porQue?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel flex flex-col gap-5">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] text-accent">{n}</span>
        <h2 className="text-[16px] font-semibold text-[#e8e3d8]">{titulo}</h2>
      </div>
      {porQue && <p className="hint -mt-3 max-w-[75ch]">{porQue}</p>}
      {children}
    </section>
  );
}

/** Marca de «esto lo decide el equipo»: recuerda que la IA no interviene en este paso. */
export function DecideElEquipo() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(111,191,178,0.4)] px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-accent">
      Lo decide el equipo · sin IA
    </span>
  );
}
