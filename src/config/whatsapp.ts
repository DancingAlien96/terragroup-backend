/**
 * whatsapp.ts — Cliente para WhatsApp Cloud API de Meta.
 *
 * IMPORTANTE: Los mensajes proactivos (los que tú envías sin que el usuario haya
 * escrito en las últimas 24h) REQUIEREN plantillas pre-aprobadas por Meta.
 *
 * Plantillas que debes crear en Meta Business Manager → WhatsApp Manager → Templates:
 *
 *   1. pago_confirmado (idioma: es)
 *      Body: "Hola {{1}}, confirmamos tu pago de Q{{2}} para el lote {{3}}. Cuota #{{4}}. ¡Gracias!"
 *
 *   2. recordatorio_cuota (idioma: es)
 *      Body: "Hola {{1}}, te recordamos que tu cuota #{{2}} del lote {{3}} vence el {{4}} por Q{{5}}."
 *
 *   3. cuota_vencida (idioma: es)
 *      Body: "Hola {{1}}, tu cuota #{{2}} del lote {{3}} venció hace {{4}} día(s). Monto: Q{{5}}. Comunícate con nosotros."
 *
 *   4. bienvenida_cliente (idioma: es)
 *      Body: "Hola {{1}}, bienvenido. Tu compra del lote {{2}} se ha registrado. Precio Q{{3}}, en {{4}} cuotas de Q{{5}}."
 *
 * Variables de entorno requeridas:
 *   WHATSAPP_TOKEN              — Access Token permanente de Meta
 *   WHATSAPP_PHONE_NUMBER_ID    — ID del número emisor (de WhatsApp Manager)
 *   WHATSAPP_DEFAULT_COUNTRY    — Código de país por defecto (default '502' = Guatemala)
 *   WHATSAPP_API_VERSION        — Versión de la Graph API (default 'v21.0')
 */

const API_VERSION = process.env.WHATSAPP_API_VERSION ?? 'v21.0';
const TOKEN       = process.env.WHATSAPP_TOKEN;
const PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const DEFAULT_CC  = process.env.WHATSAPP_DEFAULT_COUNTRY ?? '502';

function isConfigured(): boolean {
  return Boolean(TOKEN && PHONE_ID);
}

/**
 * Normaliza un teléfono a E.164 sin '+'.
 * Acepta: '5555-1234', '5555 1234', '+50255551234', '50255551234'.
 * Devuelve null si no parece un teléfono válido.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Quita todo lo que no sea dígito o '+'
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  // Si quedan 8 dígitos asume país por defecto (Guatemala)
  if (digits.length === 8) digits = DEFAULT_CC + digits;
  // Validación mínima
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

/**
 * Envía un mensaje basado en plantilla pre-aprobada por Meta.
 * Si WhatsApp no está configurado, sólo loguea y retorna sin error.
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  parameters: string[],
  language: string = 'es',
): Promise<void> {
  if (!isConfigured()) {
    console.warn('[whatsapp] No configurado (faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID). Skip.');
    return;
  }
  const phone = normalizePhone(to);
  if (!phone) {
    console.warn(`[whatsapp] Teléfono inválido: "${to}". Skip.`);
    return;
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: phone,
    type: 'template',
    template: {
      name:     templateName,
      language: { code: language },
      components: parameters.length > 0 ? [{
        type: 'body',
        parameters: parameters.map((p) => ({ type: 'text', text: String(p) })),
      }] : [],
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[whatsapp] Error ${res.status} enviando "${templateName}" a ${phone}: ${text}`);
      return;
    }
    console.log(`[whatsapp] Enviado "${templateName}" a ${phone}`);
  } catch (err) {
    console.error('[whatsapp] Error de red enviando mensaje:', err);
  }
}

/* ── Wrappers por evento ─────────────────────────────────────── */

export function sendPagoConfirmadoWA(opts: {
  to: string | null;
  clienteNombre: string;
  monto: number;
  lote: string;
  numCuota: number | null;
}): Promise<void> {
  if (!opts.to) return Promise.resolve();
  return sendWhatsAppTemplate(opts.to, 'pago_confirmado', [
    opts.clienteNombre,
    opts.monto.toFixed(2),
    opts.lote,
    String(opts.numCuota ?? '—'),
  ]);
}

export function sendRecordatorioCuotaWA(opts: {
  to: string | null;
  clienteNombre: string;
  numCuota: number;
  lote: string;
  fechaVencimiento: string;   // ya formateada
  monto: number;
}): Promise<void> {
  if (!opts.to) return Promise.resolve();
  return sendWhatsAppTemplate(opts.to, 'recordatorio_cuota', [
    opts.clienteNombre,
    String(opts.numCuota),
    opts.lote,
    opts.fechaVencimiento,
    opts.monto.toFixed(2),
  ]);
}

export function sendCuotaVencidaWA(opts: {
  to: string | null;
  clienteNombre: string;
  numCuota: number;
  lote: string;
  diasMora: number;
  monto: number;
}): Promise<void> {
  if (!opts.to) return Promise.resolve();
  return sendWhatsAppTemplate(opts.to, 'cuota_vencida', [
    opts.clienteNombre,
    String(opts.numCuota),
    opts.lote,
    String(opts.diasMora),
    opts.monto.toFixed(2),
  ]);
}

export function sendBienvenidaClienteWA(opts: {
  to: string | null;
  clienteNombre: string;
  lote: string;
  precioTotal: number;
  numCuotas: number;
  valorCuota: number;
}): Promise<void> {
  if (!opts.to) return Promise.resolve();
  return sendWhatsAppTemplate(opts.to, 'bienvenida_cliente', [
    opts.clienteNombre,
    opts.lote,
    opts.precioTotal.toFixed(2),
    String(opts.numCuotas),
    opts.valorCuota.toFixed(2),
  ]);
}
