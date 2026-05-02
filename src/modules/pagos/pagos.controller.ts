import { Request, Response } from 'express';
import * as svc from './pagos.service.js';

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
  const { contrato_id, propietario_id, monto, fecha_vencimiento } = req.body;
  if (!contrato_id || !propietario_id || !monto || !fecha_vencimiento) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const item = await svc.createPago(req.user!.empresaId, req.body);
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
