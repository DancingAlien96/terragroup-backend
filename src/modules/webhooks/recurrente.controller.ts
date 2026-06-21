/**
 * Webhook de Recurrente — activa la suscripción de la empresa al confirmarse el pago.
 *
 * Eventos manejados:
 *   - intent.succeeded → empresa.activo = true + guarda transactionId (idempotente)
 *   - intent.failed    → solo log; el cliente puede reintentar
 *   - resto            → log y 200 OK
 *
 * Seguridad:
 *   - Verifica firma Svix con RECURRENTE_WEBHOOK_SECRET
 *   - Usa raw body (configurado en app.ts antes de express.json)
 */

import { Request, Response } from 'express';
import { Webhook } from 'svix';
import prisma from '../../config/prisma.js';

const WEBHOOK_SECRET = process.env.RECURRENTE_WEBHOOK_SECRET ?? '';

interface RecurrenteWebhookPayload {
  type?:       string;        // "payment"
  event_type?: string;        // "intent.succeeded", "intent.failed", etc.
  status?:     string;        // "succeeded", "failed", ...
  id?:         string;        // pi_xxx — usado para idempotencia
  customer?:   { id?: string; email?: string; full_name?: string };
  checkout?:   { id?: string; status?: string };
  metadata?:   { empresa_id?: string; usuario_id?: string };
  amount_in_cents?: number;
  currency?:   string;
  created_at?: string;
}

export async function recurrenteWebhook(req: Request, res: Response): Promise<void> {
  if (!WEBHOOK_SECRET) {
    console.error('[webhook-recurrente] RECURRENTE_WEBHOOK_SECRET no configurado');
    res.status(500).json({ ok: false, error: 'webhook secret not configured' });
    return;
  }

  // req.body es un Buffer porque app.ts monta express.raw para esta ruta.
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

  if (eventType !== 'intent.succeeded' || payload.status !== 'succeeded') {
    res.json({ ok: true, skipped: eventType });
    return;
  }

  const empresaIdStr = payload.metadata?.empresa_id;
  const intentId     = payload.id;
  if (!empresaIdStr || !intentId) {
    console.warn('[webhook-recurrente] Falta metadata.empresa_id o id en payload');
    res.json({ ok: true, skipped: 'missing metadata' });
    return;
  }

  const empresaId = Number(empresaIdStr);
  if (!Number.isFinite(empresaId)) {
    console.warn(`[webhook-recurrente] empresa_id inválido: ${empresaIdStr}`);
    res.json({ ok: true, skipped: 'bad empresa_id' });
    return;
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, activo: true, pagoSuscripcionId: true, nombre: true },
  });

  if (!empresa) {
    console.warn(`[webhook-recurrente] Empresa ${empresaId} no existe`);
    res.json({ ok: true, skipped: 'empresa not found' });
    return;
  }

  // Idempotencia: si ya está activada con el mismo intent, no hacer nada.
  if (empresa.activo && empresa.pagoSuscripcionId === intentId) {
    console.log(`[webhook-recurrente] Empresa ${empresaId} ya activada con ${intentId}, skip`);
    res.json({ ok: true, already_active: true });
    return;
  }

  await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      activo:            true,
      pagoSuscripcionId: intentId,
      fechaInicio:       new Date(),
    },
  });

  console.log(`[webhook-recurrente] Empresa "${empresa.nombre}" (id=${empresaId}) activada con ${intentId}`);
  res.json({ ok: true, activated: true });
}
