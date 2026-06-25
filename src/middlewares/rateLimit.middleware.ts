/**
 * Rate limiting para endpoints públicos.
 *
 * Usa el store en memoria por defecto de express-rate-limit — adecuado para un
 * solo backend. Si en el futuro corremos múltiples instancias hay que migrar a
 * un store compartido (Redis con rate-limit-redis), porque cada instancia
 * tendría su propio contador.
 *
 * Los límites son agresivos pero razonables: el goal es frenar brute force
 * de password y abuso de registro, no estorbar a usuarios legítimos.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

/**
 * /api/auth/login — 10 intentos por IP cada 15 minutos.
 * Suficientemente bajo para frenar brute force, alto para permitir errores
 * humanos de tipeo. Se pueden subir por env si dan ruido.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit:    Number(process.env.RATE_LIMIT_LOGIN ?? '10'),
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  // En dev local desactivar para no estorbar; en prod activo.
  skip: () => !isProd,
  message: {
    success: false,
    message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.',
  },
});

/**
 * /api/empresas/register — 5 registros por IP por hora.
 * Combina con la validación de email duplicado del backend para evitar
 * que un mismo IP cree masivamente empresas pendientes.
 */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit:    Number(process.env.RATE_LIMIT_REGISTER ?? '5'),
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  skip: () => !isProd,
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Intenta de nuevo más tarde.',
  },
});

/**
 * /api/webhooks/recurrente — 120 webhooks por minuto.
 * Generoso porque Recurrente reintenta en bursts si el endpoint falla.
 * Se filtra por IP de Recurrente (no por usuario) — los IPs autorizados
 * realmente deberían whitelistarse, pero por ahora confiamos en la firma
 * Svix para autenticar.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit:    Number(process.env.RATE_LIMIT_WEBHOOK ?? '120'),
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  skip: () => !isProd,
  // Devolvemos 429 simple — no exponemos JSON personalizado para no dar pistas.
  // Compatible con IPv6 (sin esto, el handler legacy dispara warning).
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});
