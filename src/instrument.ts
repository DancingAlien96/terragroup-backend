/**
 * Inicialización de Sentry — DEBE importarse primero en src/index.ts.
 * El SDK v8+ requiere correr antes que cualquier otro require/import para
 * instrumentar correctamente HTTP, Express, Prisma, etc.
 *
 * Sin SENTRY_DSN se queda en no-op (en dev local típicamente).
 */

import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

// Cargar env vars ANTES de inicializar Sentry para leer SENTRY_DSN.
dotenv.config();

const DSN = process.env.SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn:              DSN,
    environment:      process.env.NODE_ENV ?? 'development',
    // Sample del 10% de transacciones (performance) — barato y útil. Si la
    // cuota se llena, se baja con SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    // Limpia datos sensibles antes de enviar.
    beforeSend(event) {
      // Nunca enviar Authorization/cookies aunque vengan en headers.
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
  console.log('[sentry] inicializado');
} else {
  console.log('[sentry] SENTRY_DSN no configurado — error tracking deshabilitado');
}
