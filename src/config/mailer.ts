import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const FROM = process.env.MAIL_FROM ?? `"TerraGroup" <${process.env.MAIL_USER}>`;

/* ── HTML base template ──────────────────────────────────────── */
function baseHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1a1a1a;padding:24px 32px;">
            <span style="font-size:22px;font-weight:bold;color:#d4a843;letter-spacing:1px;">TerraGroup</span>
            <span style="font-size:12px;color:#888;margin-left:12px;">Sistema de Gestión</span>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #eeeeee;padding:16px 32px;text-align:center;">
            <span style="font-size:11px;color:#aaa;">Este es un mensaje automático de TerraGroup · No responder a este correo</span>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/* ── Email: pago confirmado ──────────────────────────────────── */
export async function sendPagoConfirmado(opts: {
  to: string;
  clienteNombre: string;
  lote: string;
  monto: number;
  numCuota: number | null;
  fecha: string;
  referencia?: string | null;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);

  const body = `
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px;">✅ Pago registrado correctamente</h2>
    <p style="margin:0 0 24px;color:#555;font-size:14px;">Hola <strong>${opts.clienteNombre}</strong>, te confirmamos que tu pago fue recibido exitosamente.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr>
        <td style="padding:6px 0;">
          <table width="100%"><tr>
            <td style="font-size:13px;color:#888;width:140px;">Lote</td>
            <td style="font-size:14px;color:#1a1a1a;font-weight:bold;">${opts.lote}</td>
          </tr></table>
        </td>
      </tr>
      ${opts.numCuota ? `<tr><td style="padding:6px 0;"><table width="100%"><tr>
        <td style="font-size:13px;color:#888;width:140px;">N° de cuota</td>
        <td style="font-size:14px;color:#1a1a1a;font-weight:bold;">Cuota #${opts.numCuota}</td>
      </tr></table></td></tr>` : ''}
      <tr>
        <td style="padding:6px 0;">
          <table width="100%"><tr>
            <td style="font-size:13px;color:#888;width:140px;">Monto pagado</td>
            <td style="font-size:20px;color:#d4a843;font-weight:bold;">${fmt(opts.monto)}</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:6px 0;">
          <table width="100%"><tr>
            <td style="font-size:13px;color:#888;width:140px;">Fecha</td>
            <td style="font-size:14px;color:#1a1a1a;">${opts.fecha}</td>
          </tr></table>
        </td>
      </tr>
      ${opts.referencia ? `<tr><td style="padding:6px 0;"><table width="100%"><tr>
        <td style="font-size:13px;color:#888;width:140px;">Referencia</td>
        <td style="font-size:14px;color:#1a1a1a;">${opts.referencia}</td>
      </tr></table></td></tr>` : ''}
    </table>

    <p style="font-size:13px;color:#888;margin:0;">Conserva este correo como comprobante de tu pago.</p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: `✅ Pago confirmado — ${opts.lote} · ${fmt(opts.monto)}`,
    html: baseHtml('Pago confirmado', body),
  });
}

/* ── Email: recordatorio de cuota próxima ────────────────────── */
export async function sendRecordatorioCuota(opts: {
  to: string;
  clienteNombre: string;
  lote: string;
  numCuota: number;
  monto: number;
  fechaVencimiento: string;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);

  const body = `
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px;">🔔 Recordatorio de pago</h2>
    <p style="margin:0 0 24px;color:#555;font-size:14px;">Hola <strong>${opts.clienteNombre}</strong>, te recordamos que tienes una cuota próxima a vencer.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf3d9;border-left:4px solid #d4a843;border-radius:4px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:13px;color:#92700a;">Lote: <strong>${opts.lote}</strong></p>
        <p style="margin:0 0 6px;font-size:13px;color:#92700a;">Cuota #${opts.numCuota}</p>
        <p style="margin:0 0 6px;font-size:22px;color:#d4a843;font-weight:bold;">${fmt(opts.monto)}</p>
        <p style="margin:0;font-size:13px;color:#92700a;">Vence el <strong>${opts.fechaVencimiento}</strong></p>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#888;margin:0;">Por favor realiza tu pago antes de la fecha de vencimiento para evitar cargos por mora.</p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: `🔔 Recordatorio — Cuota #${opts.numCuota} vence el ${opts.fechaVencimiento}`,
    html: baseHtml('Recordatorio de pago', body),
  });
}

/* ── Email: cuenta en mora ───────────────────────────────────── */
export async function sendAvisoMora(opts: {
  to: string;
  clienteNombre: string;
  lote: string;
  cuotasVencidas: number;
  montoVencido: number;
  diasMora: number;
}) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n);

  const body = `
    <h2 style="margin:0 0 8px;color:#ef4444;font-size:20px;">⚠️ Aviso de cuenta en mora</h2>
    <p style="margin:0 0 24px;color:#555;font-size:14px;">Hola <strong>${opts.clienteNombre}</strong>, te informamos que tu cuenta presenta cuotas vencidas sin pago.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f5;border-left:4px solid #ef4444;border-radius:4px;padding:20px;margin-bottom:24px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:13px;color:#b91c1c;">Lote: <strong>${opts.lote}</strong></p>
        <p style="margin:0 0 6px;font-size:13px;color:#b91c1c;">Cuotas vencidas: <strong>${opts.cuotasVencidas}</strong></p>
        <p style="margin:0 0 6px;font-size:22px;color:#ef4444;font-weight:bold;">${fmt(opts.montoVencido)}</p>
        <p style="margin:0;font-size:13px;color:#b91c1c;">Días en mora: <strong>${opts.diasMora} días</strong></p>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#888;margin:0;">Comunícate con nosotros a la brevedad para regularizar tu cuenta y evitar consecuencias adicionales.</p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: `⚠️ Cuenta en mora — ${opts.lote} · ${opts.cuotasVencidas} cuota(s) vencida(s)`,
    html: baseHtml('Aviso de mora', body),
  });
}

/* ── Email: bienvenida nuevo usuario ─────────────────────────── */
export async function sendBienvenidaUsuario(opts: {
  to: string;
  nombre: string;
  username: string;
  password: string;
  rol: string;
}) {
  const ROL: Record<string, string> = { admin: 'Administrador', supervisor: 'Supervisor', vendedor: 'Vendedor' };
  const body = `
    <h2 style="margin:0 0 8px;color:#1a1a1a;font-size:20px;">👋 Bienvenido a TerraGroup</h2>
    <p style="margin:0 0 24px;color:#555;font-size:14px;">Hola <strong>${opts.nombre}</strong>, se ha creado una cuenta para ti en el sistema TerraGroup.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:20px;margin-bottom:24px;">
      <tr><td style="padding:6px 0;"><table width="100%"><tr>
        <td style="font-size:13px;color:#888;width:120px;">Usuario</td>
        <td style="font-size:14px;color:#1a1a1a;font-weight:bold;font-family:monospace;">${opts.username}</td>
      </tr></table></td></tr>
      <tr><td style="padding:6px 0;"><table width="100%"><tr>
        <td style="font-size:13px;color:#888;width:120px;">Contraseña</td>
        <td style="font-size:14px;color:#1a1a1a;font-weight:bold;font-family:monospace;">${opts.password}</td>
      </tr></table></td></tr>
      <tr><td style="padding:6px 0;"><table width="100%"><tr>
        <td style="font-size:13px;color:#888;width:120px;">Rol</td>
        <td style="font-size:14px;color:#1a1a1a;">${ROL[opts.rol] ?? opts.rol}</td>
      </tr></table></td></tr>
    </table>

    <p style="font-size:13px;color:#888;margin:0;">Por seguridad, te recomendamos cambiar tu contraseña al iniciar sesión por primera vez.</p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: opts.to,
    subject: `👋 Bienvenido a TerraGroup — tus credenciales de acceso`,
    html: baseHtml('Bienvenido a TerraGroup', body),
  });
}

export default transporter;
