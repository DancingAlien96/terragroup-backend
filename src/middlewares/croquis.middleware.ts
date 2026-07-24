import { NextFunction, Request, Response } from 'express';
import prisma from '../config/prisma.js';

/**
 * Bloquea las rutas del módulo croquis si la empresa del usuario no tiene el
 * add-on activo. Se aplica después de authMiddleware — asume req.user cargado.
 * Devuelve 402 (Payment Required) para que el frontend pueda distinguir
 * "no habilitado" de "no autorizado".
 */
export async function croquisEnabledMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const empresaId = req.user?.empresaId;
  if (!empresaId) return res.status(401).json({ success: false, message: 'No autorizado' });

  const e = await prisma.empresa.findUnique({
    where:  { id: empresaId },
    select: { tieneCroquis: true },
  });
  if (!e?.tieneCroquis) {
    return res.status(402).json({
      success: false,
      code:    'CROQUIS_NO_ACTIVO',
      message: 'La funcionalidad de croquis no está activa para tu cuenta. Contáctanos para habilitarla.',
    });
  }
  next();
}
