/**
 * Cliente para la API de Recurrente — pasarela de pago del SaaS.
 *
 * Modelo actual: suscripción MENSUAL recurrente con 14 días de trial gratis.
 * Cada mes Recurrente cobra automáticamente el monto del plan del cliente
 * y nos manda un webhook intent.succeeded. NO cancelamos la suscripción
 * después del primer cobro — cada mes es una renovación válida.
 *
 * Docs: https://docs.recurrente.com/referencia-api/api-reference/checkouts/create-checkout
 */

const RECURRENTE_API_URL    = process.env.RECURRENTE_API_URL    ?? 'https://app.recurrente.com/api';
const RECURRENTE_SECRET_KEY = process.env.RECURRENTE_SECRET_KEY ?? '';

export const RECURRENTE_CURRENCY      = process.env.RECURRENTE_CURRENCY ?? 'USD';
export const RECURRENTE_TRIAL_SEMANAS = Number(process.env.RECURRENTE_TRIAL_SEMANAS ?? '2');

// Precios por plan en centavos (USD por defecto). Legacy: RECURRENTE_MONTO_CENTS
// se mantiene solo como fallback para empresas viejas del modelo pago único.
export const PRECIO_BASICO_CENTS   = Number(process.env.RECURRENTE_PRECIO_BASICO_CENTS   ?? '25000');   // $250
export const PRECIO_BUSINESS_CENTS = Number(process.env.RECURRENTE_PRECIO_BUSINESS_CENTS ?? '35000');   // $350
export const PRECIO_EXTRA_PROYECTO_CENTS =
  Number(process.env.RECURRENTE_PRECIO_EXTRA_PROYECTO_CENTS ?? '5000');   // $50

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://terragroup.urbandata.app';

export type PlanSlug = 'basico' | 'business';

export interface CheckoutMetadata {
  empresa_id: string;
  usuario_id: string;
  plan?:      string;
}

export interface CheckoutResponse {
  id:           string;   // ch_xxx
  checkout_url: string;   // URL a la que redirigir al cliente
}

/** Nombre humano y precio para cada plan comercial. */
export function planConfig(plan: PlanSlug): { nombre: string; centavos: number } {
  switch (plan) {
    case 'business': return { nombre: 'Plan Business', centavos: PRECIO_BUSINESS_CENTS };
    case 'basico':
    default:         return { nombre: 'Plan Básico',   centavos: PRECIO_BASICO_CENTS };
  }
}

/**
 * Crea un checkout de suscripción mensual con 14 días de trial.
 * El primer cobro sucede al día 15, luego cada mes automáticamente.
 *
 * @returns checkout_url al que redirigir al navegador del cliente.
 */
export async function createCheckout(opts: {
  empresaId:     number;
  usuarioId:     number;
  empresaNombre: string;
  plan:          PlanSlug;
}): Promise<CheckoutResponse> {
  if (!RECURRENTE_SECRET_KEY) {
    throw new Error('RECURRENTE_SECRET_KEY no está configurada');
  }

  const { nombre, centavos } = planConfig(opts.plan);

  const metadata: CheckoutMetadata = {
    empresa_id: String(opts.empresaId),
    usuario_id: String(opts.usuarioId),
    plan:       opts.plan,
  };

  const body = {
    items: [{
      name:                      `TerraGroup — ${nombre} · ${opts.empresaNombre}`,
      amount_in_cents:           centavos,
      currency:                  RECURRENTE_CURRENCY,
      quantity:                  1,
      charge_type:               'recurring' as const,
      billing_interval:          'month'     as const,
      billing_interval_count:    1,
      free_trial_interval:       'week'      as const,
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
 * Cancela una suscripción activa en Recurrente. Llamada cuando:
 *   - Cliente cancela desde el panel de admin (durante trial o post-pago).
 *   - Un super-admin lo hace desde el panel de administración.
 *
 * En el modelo mensual NO se llama automáticamente tras cada cobro — cada
 * mes Recurrente reintenta y nosotros preservamos el acceso.
 *
 * Idempotente: si ya está cancelada, Recurrente devuelve 200 o 404 — ambos
 * los tratamos como éxito.
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
  if (!res.ok && res.status !== 404) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Recurrente cancel error (${res.status}): ${errText}`);
  }
}
