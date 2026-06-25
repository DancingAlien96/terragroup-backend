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

// Duración del trial en semanas. Default 2 (= 14 días).
export const RECURRENTE_TRIAL_SEMANAS = Number(process.env.RECURRENTE_TRIAL_SEMANAS ?? '2');

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
 * Crea un checkout en Recurrente con free trial.
 *
 * Modelo: subscription recurring con free_trial de N semanas. Después del
 * trial, Recurrente cobra una sola vez $2,000. Cancelamos la subscription
 * desde nuestro webhook al confirmarse el primer cobro para que no vuelva
 * a cobrar al próximo periodo (acceso perpetuo de un solo pago).
 *
 * @returns checkout_url al que redirigir al navegador del cliente.
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
      name:                  `${RECURRENTE_PRODUCT} — ${opts.empresaNombre}`,
      amount_in_cents:       RECURRENTE_MONTO_CENTS,
      currency:              RECURRENTE_CURRENCY,
      quantity:              1,
      charge_type:           'recurring' as const,
      // Después del trial, intenta el primer cobro. Luego nuestro webhook
      // cancela la suscripción para evitar el cobro del siguiente ciclo.
      billing_interval:       'year' as const,
      billing_interval_count: 1,
      free_trial_interval:    'week' as const,
      free_trial_interval_count: RECURRENTE_TRIAL_SEMANAS,
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

/**
 * Cancela una suscripción activa en Recurrente. Llamada en dos casos:
 *   1. Cliente cancela durante el trial desde el panel de admin.
 *   2. Tras confirmarse el primer cobro (para que no cobre al próximo periodo).
 *
 * Idempotente: si la suscripción ya está cancelada, Recurrente devuelve 200
 * o 404 — ambos los tratamos como éxito.
 */
export async function cancelSubscription(suscripcionId: string): Promise<void> {
  if (!RECURRENTE_SECRET_KEY) {
    throw new Error('RECURRENTE_SECRET_KEY no está configurada');
  }
  const res = await fetch(`${RECURRENTE_API_URL}/subscriptions/${suscripcionId}/cancel`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SECRET-KEY': RECURRENTE_SECRET_KEY,
    },
  });
  // 200 OK o 404 (ya cancelada) los tratamos como éxito.
  if (!res.ok && res.status !== 404) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Recurrente cancel error (${res.status}): ${errText}`);
  }
}
