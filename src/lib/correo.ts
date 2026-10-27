import "server-only";

import nodemailer from "nodemailer";

/**
 * Correo saliente por SMTP (sirve con Google Workspace, Brevo, Resend, Amazon
 * SES…). Se configura con SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y
 * MAIL_FROM en el .env del servidor.
 *
 * Si falta la configuración no se lanza error: se devuelve enviado=false y la
 * interfaz le muestra el enlace al administrador para que lo entregue a mano.
 */

export function correoConfigurado(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporte: nodemailer.Transporter | null = null;
function obtenerTransporte() {
  if (!transporte) {
    const puerto = Number(process.env.SMTP_PORT ?? 587);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporte;
}

const escapar = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function plantilla(titulo: string, parrafos: string[], boton: { texto: string; url: string }, nota: string): string {
  return `<!doctype html><html><body style="margin:0;background:#12181b;font-family:Arial,Helvetica,sans-serif;color:#e8e3d8">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#151c1f;border:1px solid #2a3437;border-radius:8px">
<tr><td style="padding:28px 28px 8px"><p style="margin:0;font-size:12px;letter-spacing:2px;color:#6FBFB2">VOLTAC · INNOVACIÓN</p>
<h1 style="margin:12px 0 0;font-size:22px;color:#e8e3d8">${escapar(titulo)}</h1></td></tr>
<tr><td style="padding:8px 28px;font-size:14px;line-height:1.6;color:#c9d1cf">${parrafos.map((p) => `<p>${escapar(p)}</p>`).join("")}</td></tr>
<tr><td style="padding:8px 28px 20px"><a href="${escapar(boton.url)}" style="display:inline-block;background:#6FBFB2;color:#0f2a27;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:6px">${escapar(boton.texto)}</a></td></tr>
<tr><td style="padding:0 28px 28px;font-size:12px;line-height:1.5;color:#7f8f8c"><p>${escapar(nota)}</p>
<p style="word-break:break-all">Si el botón no funciona, copia este enlace: ${escapar(boton.url)}</p></td></tr>
</table></td></tr></table></body></html>`;
}

async function enviar(para: string, asunto: string, html: string, texto: string): Promise<boolean> {
  if (!correoConfigurado()) {
    console.warn(`[correo] SMTP sin configurar: no se envió «${asunto}» a ${para}.`);
    return false;
  }
  try {
    await obtenerTransporte().sendMail({ from: process.env.MAIL_FROM ?? process.env.SMTP_USER, to: para, subject: asunto, html, text: texto });
    return true;
  } catch (e) {
    console.error(`[correo] Falló el envío de «${asunto}» a ${para}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

export function correoInvitacion(para: string, nombre: string, quienInvita: string, url: string) {
  const saludo = nombre ? `Hola, ${nombre}.` : "Hola.";
  return enviar(
    para,
    "Te invitaron a la Plataforma de Innovación Voltac",
    plantilla(
      "Te invitaron a la plataforma",
      [saludo, `${quienInvita} te invitó a la Plataforma de Innovación Voltac. Acepta la invitación para crear tu perfil y tu contraseña.`],
      { texto: "Aceptar la invitación", url },
      "El enlace vence en 72 horas y sirve una sola vez. Si no esperabas este correo, ignóralo.",
    ),
    `${saludo}\n${quienInvita} te invitó a la Plataforma de Innovación Voltac. Acepta aquí (vence en 72 horas): ${url}`,
  );
}

export function correoActivacion(para: string, nombre: string, url: string) {
  return enviar(
    para,
    "Activa tu cuenta de la Plataforma de Innovación Voltac",
    plantilla(
      "Activa tu cuenta",
      [`Hola, ${nombre}.`, "Tu perfil quedó creado. Confirma que este correo es tuyo para activar la cuenta y entrar."],
      { texto: "Activar mi cuenta", url },
      "El enlace vence en 48 horas y sirve una sola vez.",
    ),
    `Hola, ${nombre}. Activa tu cuenta aquí (vence en 48 horas): ${url}`,
  );
}

export function correoRestablecer(para: string, nombre: string, url: string) {
  return enviar(
    para,
    "Restablece tu contraseña de la Plataforma de Innovación Voltac",
    plantilla(
      "Restablece tu contraseña",
      [`Hola, ${nombre}.`, "Pediste restablecer tu contraseña. Si no fuiste tú, ignora este correo: tu contraseña no cambia."],
      { texto: "Elegir una contraseña nueva", url },
      "El enlace vence en 60 minutos y sirve una sola vez.",
    ),
    `Hola, ${nombre}. Restablece tu contraseña aquí (vence en 60 minutos): ${url}`,
  );
}
