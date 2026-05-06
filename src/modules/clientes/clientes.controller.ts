import { Request, Response } from 'express';
import * as svc from './clientes.service.js';

export async function list(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listClientes(req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function get(req: Request, res: Response) {
  try {
    const item = await svc.getCliente(Number(req.params.id), req.user!.empresaId);
    if (!item) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function create(req: Request, res: Response) {
  const { nombre_comprador, precio_neto, enganche, num_cuotas, valor_cuota, fecha_deposito } = req.body;
  if (!nombre_comprador || precio_neto == null || enganche == null || !num_cuotas || !valor_cuota || !fecha_deposito) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const item = await svc.createCliente(req.user!.empresaId, req.body);
    return res.status(201).json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await svc.updateCliente(Number(req.params.id), req.user!.empresaId, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await svc.deleteCliente(Number(req.params.id), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Cliente no encontrado' });
    return res.json({ success: true, message: 'Cliente eliminado' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}
