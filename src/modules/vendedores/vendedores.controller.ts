import { Request, Response } from 'express';
import * as svc from './vendedores.service.js';

export async function list(req: Request, res: Response) {
  try { return res.json({ success: true, data: await svc.listVendedores(req.user!.empresaId) }); }
  catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function create(req: Request, res: Response) {
  if (!req.body.nombre) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
  try {
    const item = await svc.createVendedor(req.user!.empresaId, req.body);
    return res.status(201).json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await svc.updateVendedor(Number(req.params.id), req.user!.empresaId, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await svc.deleteVendedor(Number(req.params.id), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Vendedor no encontrado' });
    return res.json({ success: true, message: 'Vendedor eliminado' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function listComisiones(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listComisiones(Number(req.params.id), req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function createComision(req: Request, res: Response) {
  const { descripcion_lote, porcentaje, monto_comision, fecha_venta } = req.body;
  if (!descripcion_lote || porcentaje === undefined || !monto_comision || !fecha_venta) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const item = await svc.createComision(req.user!.empresaId, Number(req.params.id), req.body);
    return res.status(201).json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function removeComision(req: Request, res: Response) {
  try {
    const deleted = await svc.deleteComision(Number(req.params.comisionId), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Comision no encontrada' });
    return res.json({ success: true, message: 'Comision eliminada' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}
