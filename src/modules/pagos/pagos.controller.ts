import { Request, Response } from 'express';
import * as svc from './pagos.service.js';
import pool from '../../config/database.js';
import { sendPagoConfirmado } from '../../config/mailer.js';

export async function list(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listPagos(req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function get(req: Request, res: Response) {
  try {
    const item = await svc.getPago(Number(req.params.id), req.user!.empresaId);
    if (!item) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function create(req: Request, res: Response) {
  const { monto } = req.body;
  if (!monto) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const item = await svc.createPago(req.user!.empresaId, req.body);

    // Send confirmation email if the cliente has an email registered (fire-and-forget)
    if (item.cliente_id) {
      (async () => {
        try {
          const [rows] = await pool.query(
            `SELECT email, nombre_comprador, descripcion_lote FROM clientes WHERE id = ? LIMIT 1`,
            [item.cliente_id],
          ) as any;
          const cliente = (rows as any[])[0];
          if (cliente?.email) {
            const fecha = item.fecha_pago
              ? new Date(item.fecha_pago + 'T12:00:00').toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' })
              : new Date().toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric' });
            await sendPagoConfirmado({
              to:            cliente.email,
              clienteNombre: cliente.nombre_comprador,
              lote:          cliente.descripcion_lote ?? 'Sin lote',
              monto:         Number(item.monto),
              numCuota:      item.num_cuota,
              fecha,
              referencia:    item.referencia,
            });
          }
        } catch { /* silencioso — no interrumpir si falla el correo */ }
      })();
    }

    return res.status(201).json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await svc.updatePago(Number(req.params.id), req.user!.empresaId, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await svc.deletePago(Number(req.params.id), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Pago no encontrado' });
    return res.json({ success: true, message: 'Pago eliminado' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}
