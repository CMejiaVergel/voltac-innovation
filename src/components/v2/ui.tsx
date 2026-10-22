import Link from "next/link";
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

/** Bloque de un formulario: un título y, si hace falta, una línea de ayuda. */
export function Bloque({
  titulo,
  porQue,
  children,
}: {
  n?: string;
  titulo: string;
  porQue?: string;
  children: ReactNode;
}) {
  return (
    <section className="panel flex flex-col gap-5">
      <div>
        <h2 className="text-[16px] font-semibold text-[#e8e3d8]">{titulo}</h2>
        {porQue && <p className="hint mt-1 max-w-[75ch]">{porQue}</p>}
      </div>
      {children}
    </section>
  );
}


/** El siguiente paso del flujo, para que nadie se quede preguntando «¿y ahora qué?». */
export function Siguiente({ href, label, nota }: { href: string; label: string; nota?: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[rgba(232,227,216,0.1)] pt-5">
      <Link href={href} className="btn btn-primary">
        {label} →
      </Link>
      {nota && <span className="text-[12px] text-[#7f8f8c]">{nota}</span>}
    </div>
  );
}
