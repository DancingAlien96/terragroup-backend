import { Request, Response } from 'express';
import * as svc from './pagos.service.js';
import prisma from '../../config/prisma.js';
import { sendPagoConfirmado } from '../../config/mailer.js';
import { logAudit } from '../../utils/audit.js';

export async function list(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listPagos(req.user!.empresaId) });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function get(req: Request, res: Response) {
  try {
    const item = await svc.getPago(Number(req.params.id), req.user!.empresaId);
    if (!item) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function create(req: Request, res: Response) {
  if (!req.body.monto) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const item = await svc.createPago(req.user!.empresaId, req.body);

    logAudit({
      empresaId: req.user!.empresaId, usuarioId: req.user!.id,
      entidad: 'Pago', entidadId: item.id, accion: 'crear',
      descripcion: `Pago recibo #${item.num_recibo} · ${item.propietario_nombre} · Q${item.monto}`,
    });

    // Enviar correo de confirmación (fire-and-forget) si el propietario tiene email
    if (item.venta_id) {
      (async () => {
        try {
          const venta = await prisma.venta.findUnique({
            where:  { id: item.venta_id! },
            select: {
              propietario:     { select: { nombre: true, email: true } },
              descripcionLote: true,
              lote:            { select: { clave: true } },
            },
          });
          const email = venta?.propietario?.email;
          if (email) {
            const fecha = item.fecha_pago
              ? new Date(item.fecha_pago).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })
              : new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
            await sendPagoConfirmado({
              to:            email,
              clienteNombre: venta!.propietario.nombre,
              lote:          venta!.descripcionLote ?? venta!.lote?.clave ?? 'Sin lote',
              monto:         Number(item.monto),
              numCuota:      item.num_cuota,
              fecha,
              referencia:    item.referencia,
            });
          }
        } catch { /* silencioso */ }
      })();
    }

    return res.status(201).json({ success: true, data: item });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await svc.updatePago(Number(req.params.id), req.user!.empresaId, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    logAudit({
      empresaId: req.user!.empresaId, usuarioId: req.user!.id,
      entidad: 'Pago', entidadId: item.id, accion: 'actualizar',
      descripcion: `Pago recibo #${item.num_recibo ?? '—'}`,
      cambios: req.body,
    });
    return res.json({ success: true, data: item });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const pagoId = Number(req.params.id);
    const deleted = await svc.deletePago(pagoId, req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    logAudit({
      empresaId: req.user!.empresaId, usuarioId: req.user!.id,
      entidad: 'Pago', entidadId: pagoId, accion: 'eliminar',
    });
    return res.json({ success: true, message: 'Pago eliminado' });
  } catch (e: any) {
    if (e?.name === 'ValidationError') return res.status(400).json({ success: false, message: e.message });
    return res.status(500).json({ success: false, message: String(e) });
  }
}
