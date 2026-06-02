/**
 * error.ts — Helpers para responder errores sin filtrar detalles internos.
 *
 * Antes el patrón era `res.status(500).json({ success: false, message: String(err) })`,
 * que filtra stack traces, mensajes de Prisma con nombres de columna, etc.
 * Ahora se loguea el error completo y se devuelve un mensaje genérico.
 */

import type { Response } from 'express';

export function serverError(res: Response, err: unknown, context?: string): Response {
  console.error(`[error]${context ? ` [${context}]` : ''}`, err);
  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
  });
}
