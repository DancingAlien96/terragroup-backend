import { Request, Response } from 'express';
import * as svc from './vendedores.service.js';

export async function listVendedores(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listVendedores(req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function listComisiones(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listComisiones(req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function createComision(req: Request, res: Response) {
  const { vendedor_id, pago_id, porcentaje, monto } = req.body;
  if (!vendedor_id || !pago_id || porcentaje === undefined || monto === undefined) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const item = await svc.createComision(req.user!.empresaId, { vendedor_id, pago_id, porcentaje, monto });
    return res.status(201).json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function togglePagada(req: Request, res: Response) {
  try {
    const ok = await svc.toggleComisionPagada(Number(req.params.id), req.user!.empresaId);
    if (!ok) return res.status(404).json({ success: false, message: 'Comisión no encontrada' });
    return res.json({ success: true, message: 'Estado actualizado' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}
