/**
 * Cliente para la API de Recurrente — pasarela de pago del SaaS.
 *
 * Una sola operación: crear checkout one-time para que la empresa pague
 * la suscripción única. Cuando Recurrente confirma el pago vía webhook
 * (intent.succeeded), el backend activa la empresa.
 *
 * Docs: https://docs.recurrente.com/referencia-api/api-reference/checkouts/create-checkout
 */

const RECURRENTE_API_URL    = process.env.RECURRENTE_API_URL    ?? 'https://app.recurrente.com/api';
const RECURRENTE_SECRET_KEY = process.env.RECURRENTE_SECRET_KEY ?? '';

export const RECURRENTE_MONTO_CENTS = Number(process.env.RECURRENTE_MONTO_CENTS ?? '200000');
export const RECURRENTE_CURRENCY    = process.env.RECURRENTE_CURRENCY ?? 'USD';
export const RECURRENTE_PRODUCT     = process.env.RECURRENTE_PRODUCT  ?? 'TerraGroup — Licencia única';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://terragroup.urbandata.app';

export interface CheckoutMetadata {
  empresa_id: string;
  usuario_id: string;
}

export interface CheckoutResponse {
  id:           string;   // ch_xxx
  checkout_url: string;   // URL a la que redirigir al cliente
}

/**
 * Crea un checkout one-time en Recurrente.
 *
 * @returns checkout_url al que redirigir al navegador del cliente.
 * @throws si la API key no está configurada o si Recurrente devuelve error.
 */
export async function createCheckout(opts: {
  empresaId: number;
  usuarioId: number;
  empresaNombre: string;
}): Promise<CheckoutResponse> {
  if (!RECURRENTE_SECRET_KEY) {
    throw new Error('RECURRENTE_SECRET_KEY no está configurada');
  }

  const metadata: CheckoutMetadata = {
    empresa_id: String(opts.empresaId),
    usuario_id: String(opts.usuarioId),
  };

  const body = {
    items: [{
      name:            `${RECURRENTE_PRODUCT} — ${opts.empresaNombre}`,
      amount_in_cents: RECURRENTE_MONTO_CENTS,
      currency:        RECURRENTE_CURRENCY,
      quantity:        1,
      charge_type:     'one_time' as const,
    }],
    success_url: `${FRONTEND_URL}/register/exito?empresa=${opts.empresaId}`,
    cancel_url:  `${FRONTEND_URL}/register/cancelado?empresa=${opts.empresaId}`,
    metadata,
  };

  const res = await fetch(`${RECURRENTE_API_URL}/checkouts`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SECRET-KEY': RECURRENTE_SECRET_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Recurrente checkout error (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as CheckoutResponse;
  if (!json.checkout_url) {
    throw new Error('Recurrente devolvió respuesta sin checkout_url');
  }
  return json;
}
