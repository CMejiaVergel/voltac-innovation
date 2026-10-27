"use client";

import { useActionState, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  activarCuenta,
  aceptarInvitacion,
  cambiarClave,
  enviarRestablecer,
  guardarPerfil,
  invitar,
  reenviarActivacion,
  reenviarInvitacion,
  restablecerClave,
  solicitarRestablecer,
  type EstadoCuenta,
} from "@/app/actions/cuentas";

const INICIAL: EstadoCuenta = { ok: false, mensaje: "" };

/**
 * Envía el formulario sin dejar que React lo vacíe: con una acción directa,
 * React 19 resetea los campos tras cada envío y, ante un error, la persona
 * perdería lo que escribió y la foto elegida.
 */
function useFormulario(accion: (prev: EstadoCuenta, fd: FormData) => Promise<EstadoCuenta>) {
  const [estado, despachar] = useActionState(accion, INICIAL);
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => despachar(fd));
  };
  return { estado, onSubmit, pending };
}

function Enviar({ texto, cargando = "Guardando…", className = "btn btn-primary", pending }: { texto: string; cargando?: string; className?: string; pending: boolean }) {
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? cargando : texto}
    </button>
  );
}

/** Mensaje del resultado y, si el correo no salió, el enlace para copiar. */
export function Resultado({ estado }: { estado: EstadoCuenta }) {
  const [copiado, setCopiado] = useState(false);
  if (!estado.mensaje) return null;
  return (
    <div
      className={`rounded-[4px] border p-3 text-[12.5px] leading-relaxed ${
        estado.ok ? "border-[rgba(111,191,178,0.45)] bg-[rgba(111,191,178,0.1)] text-accent" : "border-[rgba(142,51,36,0.5)] bg-[rgba(142,51,36,0.15)] text-[#e8a99c]"
      }`}
      role="status"
    >
      {estado.mensaje}
      {estado.enlace && (
        <div className="mt-2 flex gap-2">
          <input readOnly value={estado.enlace} className="field flex-1 font-mono text-[11px]" onFocus={(e) => e.target.select()} />
          <button
            type="button"
            className="btn"
            onClick={() => navigator.clipboard.writeText(estado.enlace!).then(() => setCopiado(true))}
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Campos compartidos ──────────────────────────────────────────────────────

function CamposClave({ etiqueta = "Contraseña" }: { etiqueta?: string }) {
  return (
    <>
      <label className="block">
        <span className="label">{etiqueta}</span>
        <input name="clave" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="field" />
        <span className="mt-1 block text-[11px] text-[#7f8f8c]">Al menos 12 caracteres. Una frase larga es más segura que símbolos raros.</span>
      </label>
      <label className="block">
        <span className="label">Repítela</span>
        <input name="clave2" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="field" />
      </label>
    </>
  );
}

function CamposPerfil({ nombre = "", cargo = "", formacion = "", fotoUrl, fotoObligatoria }: { nombre?: string; cargo?: string; formacion?: string; fotoUrl?: string | null; fotoObligatoria: boolean }) {
  const [vista, setVista] = useState<string | null>(fotoUrl ?? null);
  return (
    <>
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[rgba(232,227,216,0.2)] bg-[rgba(232,227,216,0.05)]">
          {vista ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vista} alt="Tu foto" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] text-[#7f8f8c]">Sin foto</span>
          )}
        </div>
        <label className="block flex-1">
          <span className="label">Foto de perfil{fotoObligatoria ? "" : " (opcional cambiarla)"}</span>
          <input
            name="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required={fotoObligatoria}
            className="block w-full text-[12px] text-[#a9b5b3] file:mr-3 file:rounded-[4px] file:border-0 file:bg-[rgba(111,191,178,0.18)] file:px-3 file:py-1.5 file:text-accent"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setVista(URL.createObjectURL(f));
            }}
          />
          <span className="mt-1 block text-[11px] text-[#7f8f8c]">JPG, PNG o WEBP de hasta 2 MB. Aparece en la presentación del equipo.</span>
        </label>
      </div>
      <label className="block">
        <span className="label">Nombre completo</span>
        <input name="nombre" defaultValue={nombre} required maxLength={120} autoComplete="name" className="field" />
      </label>
      <label className="block">
        <span className="label">Rol en el equipo</span>
        <input name="cargo" defaultValue={cargo} required maxLength={120} placeholder="Ej. Ingeniero de procesos · líder del reto" className="field" />
      </label>
      <label className="block">
        <span className="label">Formación y experiencia</span>
        <textarea name="formacion" defaultValue={formacion} maxLength={600} rows={3} placeholder="En una o dos líneas: tu formación y la experiencia que aportas" className="field resize-y" />
      </label>
    </>
  );
}

// ─── Administración ──────────────────────────────────────────────────────────

export function FormInvitar() {
  const { estado, onSubmit, pending } = useFormulario(invitar);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="nombre" maxLength={120} className="field" placeholder="Nombre (opcional)" />
        <input name="email" type="email" required maxLength={200} className="field" placeholder="correo@empresa.com" />
      </div>
      <div className="flex items-center gap-3">
        <Enviar texto="Enviar invitación" cargando="Enviando…" pending={pending} />
        <span className="text-[11.5px] text-[#7f8f8c]">Entra como miembro. Los administradores solo se crean desde la terminal del servidor.</span>
      </div>
      <Resultado estado={estado} />
    </form>
  );
}

/** Un botón de administración que devuelve un enlace (reenviar, activar, restablecer). */
export function AccionConEnlace({ id, tipo }: { id: string; tipo: "INVITACION" | "ACTIVACION" | "RESTABLECER" }) {
  const accionServidor = tipo === "INVITACION" ? reenviarInvitacion : tipo === "ACTIVACION" ? reenviarActivacion : enviarRestablecer;
  const { estado, onSubmit, pending } = useFormulario(accionServidor);
  const texto = { INVITACION: "Reenviar invitación", ACTIVACION: "Reenviar activación", RESTABLECER: "Enviar enlace para restablecer contraseña" }[tipo];
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <Enviar texto={texto} cargando="Enviando…" className="btn self-start" pending={pending} />
      <Resultado estado={estado} />
    </form>
  );
}

// ─── Invitación, activación y recuperación (páginas públicas) ───────────────

export function FormAceptarInvitacion({ token, nombre }: { token: string; nombre: string }) {
  const { estado, onSubmit, pending } = useFormulario(aceptarInvitacion.bind(null, token));
  if (estado.ok) return <Resultado estado={estado} />;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <CamposPerfil nombre={nombre} fotoObligatoria />
      <CamposClave />
      <Resultado estado={estado} />
      <Enviar texto="Crear mi perfil" cargando="Creando…" pending={pending} />
    </form>
  );
}

export function FormActivar({ token }: { token: string }) {
  const { estado, onSubmit, pending } = useFormulario(async () => activarCuenta(token));
  if (estado.ok)
    return (
      <div className="flex flex-col gap-4">
        <Resultado estado={estado} />
        <Link href="/login" className="btn btn-primary self-start">
          Iniciar sesión
        </Link>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-[13px] text-[#c9d1cf]">Confirma que este correo es tuyo para activar tu cuenta.</p>
      <Resultado estado={estado} />
      <Enviar texto="Activar mi cuenta" cargando="Activando…" pending={pending} />
    </form>
  );
}

export function FormRecuperar() {
  const { estado, onSubmit, pending } = useFormulario(solicitarRestablecer);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="block">
        <span className="label">Correo de tu cuenta</span>
        <input name="email" type="email" required maxLength={200} autoComplete="username" className="field" />
      </label>
      <Resultado estado={estado} />
      <Enviar texto="Enviarme el enlace" cargando="Enviando…" pending={pending} />
    </form>
  );
}

export function FormRestablecer({ token }: { token: string }) {
  const { estado, onSubmit, pending } = useFormulario(restablecerClave.bind(null, token));
  if (estado.ok)
    return (
      <div className="flex flex-col gap-4">
        <Resultado estado={estado} />
        <Link href="/login" className="btn btn-primary self-start">
          Iniciar sesión
        </Link>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <CamposClave etiqueta="Contraseña nueva" />
      <Resultado estado={estado} />
      <Enviar texto="Cambiar contraseña" pending={pending} />
    </form>
  );
}

// ─── Perfil propio ───────────────────────────────────────────────────────────

export function FormPerfil({
  nombre,
  cargo,
  formacion,
  fotoUrl,
  alTerminar,
}: {
  nombre: string;
  cargo: string;
  formacion: string;
  fotoUrl: string | null;
  /** A dónde ir cuando se guarda (la bienvenida lleva a los proyectos). */
  alTerminar?: string;
}) {
  const router = useRouter();
  const { estado, onSubmit, pending } = useFormulario(async (prev: EstadoCuenta, fd: FormData) => {
    const r = await guardarPerfil(prev, fd);
    if (r.ok && alTerminar) router.push(alTerminar);
    else if (r.ok) router.refresh();
    return r;
  });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <CamposPerfil nombre={nombre} cargo={cargo} formacion={formacion} fotoUrl={fotoUrl} fotoObligatoria={!fotoUrl} />
      <Resultado estado={estado} />
      <Enviar texto={alTerminar ? "Guardar y continuar" : "Guardar perfil"} pending={pending} />
    </form>
  );
}

export function FormCambiarClave() {
  const { estado, onSubmit, pending } = useFormulario(cambiarClave);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="block">
        <span className="label">Contraseña actual</span>
        <input name="actual" type="password" autoComplete="current-password" required className="field" />
      </label>
      <CamposClave etiqueta="Contraseña nueva" />
      <Resultado estado={estado} />
      <Enviar texto="Cambiar contraseña" pending={pending} />
    </form>
  );
}
