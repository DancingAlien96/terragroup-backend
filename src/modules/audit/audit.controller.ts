import { Request, Response } from 'express';
import prisma from '../../config/prisma.js';

/**
 * GET /api/audit
 * Query params:
 *   - entidad   (opcional, filtra por tipo: 'Venta', 'Pago', etc.)
 *   - entidadId (opcional, filtra por id de la entidad)
 *   - limit     (default 100, max 500)
 */
export async function list(req: Request, res: Response) {
  try {
    const empresaId = req.user!.empresaId;
    const entidad   = typeof req.query.entidad === 'string' ? req.query.entidad : undefined;
    const entidadId = req.query.entidadId ? Number(req.query.entidadId) : undefined;
    const limit     = Math.min(Number(req.query.limit) || 100, 500);

    const rows = await prisma.auditLog.findMany({
      where: {
        empresaId,
        ...(entidad   && { entidad }),
        ...(entidadId && { entidadId }),
      },
      include: {
        usuario: { select: { id: true, nombre: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json({
      success: true,
      data: rows.map((r) => ({
        id:          r.id,
        empresa_id:  r.empresaId,
        usuario_id:  r.usuarioId,
        usuario:     r.usuario ? { id: r.usuario.id, nombre: r.usuario.nombre, username: r.usuario.username } : null,
        entidad:     r.entidad,
        entidad_id:  r.entidadId,
        accion:      r.accion,
        descripcion: r.descripcion,
        cambios:     r.cambios,
        created_at:  r.createdAt,
      })),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: String(e) });
  }
}
