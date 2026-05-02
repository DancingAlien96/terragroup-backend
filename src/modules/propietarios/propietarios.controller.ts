import { Request, Response } from 'express';
import * as svc from './propietarios.service.js';

export async function list(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listPropietarios(req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function get(req: Request, res: Response) {
  try {
    const item = await svc.getPropietario(Number(req.params.id), req.user!.empresaId);
    if (!item) return res.status(404).json({ success: false, message: 'Propietario no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function create(req: Request, res: Response) {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
  try {
    const item = await svc.createPropietario(req.user!.empresaId, req.body);
    return res.status(201).json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await svc.updatePropietario(Number(req.params.id), req.user!.empresaId, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Propietario no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await svc.deletePropietario(Number(req.params.id), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Propietario no encontrado' });
    return res.json({ success: true, message: 'Propietario eliminado' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}
