/**
 * Webhook de Recurrente — público (verificado por firma Svix).
 *
 * IMPORTANTE: esta ruta NO usa express.json porque Svix necesita el raw body
 * para verificar la firma HMAC. Se monta con express.raw en app.ts ANTES del
 * middleware global express.json.
 */

import { Router } from 'express';
import { recurrenteWebhook } from './recurrente.controller.js';

const router = Router();

router.post('/', recurrenteWebhook);

export default router;
