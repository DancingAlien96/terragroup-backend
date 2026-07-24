/**
 * Webhook de Recurrente — gestiona el ciclo de vida de la suscripción con trial.
 *
 * Eventos manejados:
 *   - setup_intent.succeeded → tarjeta guardada al inicio del trial.
 *     Activa la empresa con estadoSuscripcion='trial', trialInicio=now,
 *     trialFin=now+14d, guarda suscripcionId.
 *   - intent.succeeded → cobro del día 15 exitoso. Marca como 'pagada'
 *     y cancela la subscription en Recurrente (acceso perpetuo de 1 pago).
 *   - intent.failed → cobro del día 15 falló. Marca como 'pago_fallido'.
 *     Recurrente reintenta automáticamente; un cron interno suspende
 *     después de N días sin éxito.
 *   - subscription.cancel → cliente canceló (vía panel admin o trial).
 *     Marca como 'cancelada' y desactiva.
 *   - Otros → log y 200 OK.
 *
 * Seguridad:
 *   - Verifica firma Svix con RECURRENTE_WEBHOOK_SECRET
 *   - Usa raw body (configurado en app.ts antes de express.json)
 */

import { Request, Response } from 'express';
import { Webhook } from 'svix';
import prisma from '../../config/prisma.js';
import { RECURRENTE_TRIAL_SEMANAS } from '../../config/recurrente.js';
import { EstadoSuscripcion } from '../../generated/prisma/enums.js';

const WEBHOOK_SECRET = process.env.RECURRENTE_WEBHOOK_SECRET ?? '';

interface RecurrenteMetadata {
  empresa_id?: string;
  usuario_id?: string;
  /** 'plan' (default legacy) o 'proyecto_extra' — discrimina el flujo. */
  tipo?:       string;
}

interface RecurrenteWebhookPayload {
  type?:       string;
  event_type?: string;        // "setup_intent.succeeded", "intent.succeeded", ...
  status?:     string;
  id?:         string;        // pi_xxx / in_xxx / si_xxx
  customer?:   { id?: string; email?: string; full_name?: string };
  checkout?:   { id?: string; status?: string; metadata?: RecurrenteMetadata };
  subscription?: { id?: string };
  metadata?:   RecurrenteMetadata;
  data?:       { metadata?: RecurrenteMetadata };
  amount_in_cents?: number;
  currency?:   string;
  created_at?: string;
}

function extractMetadata(p: RecurrenteWebhookPayload): RecurrenteMetadata {
  return p.metadata ?? p.checkout?.metadata ?? p.data?.metadata ?? {};
}

function diasFuturos(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d;
}

export async function recurrenteWebhook(req: Request, res: Response): Promise<void> {
  if (!WEBHOOK_SECRET) {
    console.error('[webhook-recurrente] RECURRENTE_WEBHOOK_SECRET no configurado');
    res.status(500).json({ ok: false, error: 'webhook secret not configured' });
    return;
  }

  const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(req.body);
  const svixHeaders = {
    'svix-id':        req.header('svix-id')        ?? '',
    'svix-timestamp': req.header('svix-timestamp') ?? '',
    'svix-signature': req.header('svix-signature') ?? '',
  };

  let payload: RecurrenteWebhookPayload;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    payload = wh.verify(rawBody.toString('utf8'), svixHeaders) as RecurrenteWebhookPayload;
  } catch (err) {
    console.warn('[webhook-recurrente] Firma inválida:', (err as Error).message);
    res.status(400).json({ ok: false, error: 'invalid signature' });
    return;
  }

  const eventType = payload.event_type ?? '';
  console.log(`[webhook-recurrente] ${eventType} status=${payload.status} id=${payload.id}`);

  const metadata = extractMetadata(payload);
  const empresaIdStr = metadata.empresa_id;
  const empresaId    = empresaIdStr ? Number(empresaIdStr) : NaN;

  // Add-on de proyecto extra: intent.succeeded incrementa el contador y
  // NO toca estado de la suscripción principal. setup_intent y demás se
  // ignoran silenciosamente porque no aplican al add-on.
  if (metadata.tipo === 'proyecto_extra') {
    if (eventType === 'intent.succeeded') {
      await handleProyectoExtraSucceeded(empresaId, payload, res);
      return;
    }
    res.json({ ok: true, skipped: `proyecto_extra ${eventType}` });
    return;
  }

  // Despachador por tipo de evento.
  switch (eventType) {
    case 'setup_intent.succeeded':
      await handleSetupIntentSucceeded(empresaId, payload, res);
      return;
    case 'intent.succeeded':
      await handleIntentSucceeded(empresaId, payload, res);
      return;
    case 'intent.failed':
    case 'intent.canceled':
      await handleIntentFailed(empresaId, payload, res);
      return;
    case 'subscription.cancel':
    case 'subscription.canceled':
      await handleSubscriptionCanceled(empresaId, payload, res);
      return;
    default:
      res.json({ ok: true, skipped: eventType });
  }
}

/* ── Handlers ───────────────────────────────────────────────────────── */

async function handleSetupIntentSucceeded(
  empresaId: number,
  payload: RecurrenteWebhookPayload,
  res: Response,
) {
  if (!Number.isFinite(empresaId)) {
    console.warn('[webhook-recurrente] setup_intent sin empresa_id válido');
    res.json({ ok: true, skipped: 'missing empresa_id' });
    return;
  }

  const empresa = await prisma.empresa.findUnique({
    where:  { id: empresaId },
    select: { id: true, estadoSuscripcion: true, nombre: true },
  });
  if (!empresa) {
    res.json({ ok: true, skipped: 'empresa not found' });
    return;
  }

  // Idempotencia: si ya está en trial o más avanzado, no hacer nada.
  if (empresa.estadoSuscripcion !== EstadoSuscripcion.pendiente) {
    console.log(`[webhook-recurrente] Empresa ${empresaId} no está en pendiente (${empresa.estadoSuscripcion}), skip setup_intent`);
    res.json({ ok: true, already_in_trial: true });
    return;
  }

  const trialDias = RECURRENTE_TRIAL_SEMANAS * 7;
  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      activo:            true,
      estadoSuscripcion: EstadoSuscripcion.trial,
      trialInicio:       new Date(),
      trialFin:          diasFuturos(trialDias),
      fechaInicio:       new Date(),
      suscripcionId:     payload.subscription?.id ?? null,
    },
  });

  console.log(`[webhook-recurrente] Empresa "${empresa.nombre}" (id=${empresaId}) en trial por ${trialDias} días`);
  res.json({ ok: true, trial_activated: true });
}

async function handleIntentSucceeded(
  empresaId: number,
  payload: RecurrenteWebhookPayload,
  res: Response,
) {
  if (!Number.isFinite(empresaId) || !payload.id) {
    res.json({ ok: true, skipped: 'missing data' });
    return;
  }

  const empresa = await prisma.empresa.findUnique({
    where:  { id: empresaId },
    select: { id: true, estadoSuscripcion: true, suscripcionId: true, pagoSuscripcionId: true, nombre: true },
  });
  if (!empresa) {
    res.json({ ok: true, skipped: 'empresa not found' });
    return;
  }

  // Idempotencia: ya pagada con el mismo intent.
  if (empresa.estadoSuscripcion === EstadoSuscripcion.pagada &&
      empresa.pagoSuscripcionId === payload.id) {
    res.json({ ok: true, already_paid: true });
    return;
  }

  // Modelo mensual: cada intent.succeeded es una renovación válida.
  // NO cancelamos la suscripción — cada mes Recurrente cobra automático.
  // Guardamos el último intent en pagoSuscripcionId para idempotencia y
  // trazabilidad del último cobro exitoso.
  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      activo:            true,
      estadoSuscripcion: EstadoSuscripcion.pagada,
      pagoSuscripcionId: payload.id,
    },
  });

  console.log(`[webhook-recurrente] Empresa "${empresa.nombre}" (id=${empresaId}) cobro mensual OK — intent ${payload.id}`);
  res.json({ ok: true, paid: true });
}

async function handleIntentFailed(
  empresaId: number,
  _payload: RecurrenteWebhookPayload,
  res: Response,
) {
  if (!Number.isFinite(empresaId)) {
    res.json({ ok: true, skipped: 'missing empresa_id' });
    return;
  }

  const empresa = await prisma.empresa.findUnique({
    where:  { id: empresaId },
    select: { estadoSuscripcion: true, nombre: true },
  });
  if (!empresa) {
    res.json({ ok: true, skipped: 'empresa not found' });
    return;
  }

  // Solo movemos a pago_fallido si estaba en trial o ya en pago_fallido.
  // No tocamos empresas ya pagadas o canceladas.
  if (empresa.estadoSuscripcion !== EstadoSuscripcion.trial &&
      empresa.estadoSuscripcion !== EstadoSuscripcion.pago_fallido) {
    res.json({ ok: true, skipped: `estado ${empresa.estadoSuscripcion}` });
    return;
  }

  await prisma.empresa.update({
    where: { id: empresaId },
    data:  { estadoSuscripcion: EstadoSuscripcion.pago_fallido },
  });
  console.log(`[webhook-recurrente] Empresa "${empresa.nombre}" (id=${empresaId}) en pago_fallido (Recurrente reintentará)`);
  res.json({ ok: true, payment_failed: true });
}

/**
 * Cobro exitoso de un add-on "proyecto extra": inserta el intent.id en
 * empresa_extra_compras (UNIQUE) — si ya existía, es reintento del webhook
 * y no incrementamos otra vez. Si es nuevo, aumentamos proyectosExtra en +1.
 *
 * Nota: cada renovación mensual del add-on también dispara intent.succeeded
 * con un intent.id NUEVO — cada mes se "incrementaría" de nuevo. Esto NO
 * es lo que queremos (el cliente pagó por el mismo slot). Para diferenciar
 * COMPRA NUEVA de RENOVACIÓN, Recurrente incluye subscription.id: la
 * primera vez para esa subscription.id, es una compra nueva; posteriores
 * son renovaciones. Idempotencia por (subscription_id) NO por (intent_id).
 */
async function handleProyectoExtraSucceeded(
  empresaId: number,
  payload: RecurrenteWebhookPayload,
  res: Response,
) {
  if (!Number.isFinite(empresaId)) {
    res.json({ ok: true, skipped: 'missing empresa_id' });
    return;
  }
  // Usamos subscription.id como clave de idempotencia — la primera vez que
  // vemos esa subscription es la compra; renovaciones futuras vienen con la
  // misma subscription.id y ya existen en la tabla.
  const suscripcionId = payload.subscription?.id ?? payload.id;
  if (!suscripcionId) {
    res.json({ ok: true, skipped: 'missing subscription id' });
    return;
  }

  try {
    await prisma.empresaExtraCompra.create({
      data: { empresaId, intentId: suscripcionId },
    });
  } catch (err: any) {
    // P2002 = unique violation → ya lo procesamos (renovación o retry)
    if (err?.code === 'P2002') {
      console.log(`[webhook-recurrente] proyecto_extra ${suscripcionId} ya contabilizado (renovación o retry)`);
      res.json({ ok: true, already_counted: true });
      return;
    }
    throw err;
  }

  const empresa = await prisma.empresa.update({
    where: { id: empresaId },
    data:  { proyectosExtra: { increment: 1 } },
    select: { nombre: true, proyectosExtra: true },
  });
  console.log(`[webhook-recurrente] Empresa "${empresa.nombre}" (id=${empresaId}) +1 proyecto extra → ${empresa.proyectosExtra} total`);
  res.json({ ok: true, extra_added: true, total: empresa.proyectosExtra });
}

async function handleSubscriptionCanceled(
  empresaId: number,
  _payload: RecurrenteWebhookPayload,
  res: Response,
) {
  if (!Number.isFinite(empresaId)) {
    res.json({ ok: true, skipped: 'missing empresa_id' });
    return;
  }

  const empresa = await prisma.empresa.findUnique({
    where:  { id: empresaId },
    select: { estadoSuscripcion: true, nombre: true },
  });
  if (!empresa) {
    res.json({ ok: true, skipped: 'empresa not found' });
    return;
  }

  // Si ya pagó, la cancelación viene de nuestro propio call para frenar
  // futuros cobros — el cliente conserva el acceso. NO desactivar.
  if (empresa.estadoSuscripcion === EstadoSuscripcion.pagada) {
    console.log(`[webhook-recurrente] subscription.cancel post-pago para empresa "${empresa.nombre}" — acceso preservado`);
    res.json({ ok: true, post_payment_cancel: true });
    return;
  }

  // Cancelación durante trial o tras pago fallido: el cliente pierde acceso.
  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      activo:            false,
      estadoSuscripcion: EstadoSuscripcion.cancelada,
    },
  });
  console.log(`[webhook-recurrente] Empresa "${empresa.nombre}" (id=${empresaId}) cancelada`);
  res.json({ ok: true, canceled: true });
}
