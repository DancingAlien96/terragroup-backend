import { Request, Response } from 'express';
import * as svc from './lotes.service.js';

export async function list(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listLotes(req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: 'Error interno del servidor' }); }
}

export async function get(req: Request, res: Response) {
  try {
    const lote = await svc.getLote(Number(req.params.id), req.user!.empresaId);
    if (!lote) return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    return res.json({ success: true, data: lote });
  } catch (e) { return res.status(500).json({ success: false, message: 'Error interno del servidor' }); }
}

export async function create(req: Request, res: Response) {
  const { clave } = req.body;
  if (!clave) return res.status(400).json({ success: false, message: 'La clave es requerida' });
  try {
    const lote = await svc.createLote(req.user!.empresaId, req.body);
    return res.status(201).json({ success: true, data: lote });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY' || e?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Clave de lote ya existe' });
    }
    if (e instanceof Error && e.message.includes('proyecto')) {
      return res.status(400).json({ success: false, message: e.message });
    }
    console.error('[lotes create]', e);
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const lote = await svc.updateLote(Number(req.params.id), req.user!.empresaId, req.body);
    if (!lote) return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    return res.json({ success: true, data: lote });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Clave de lote ya existe' });
    return res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await svc.deleteLote(Number(req.params.id), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    return res.json({ success: true, message: 'Lote eliminado' });
  } catch (e) { return res.status(500).json({ success: false, message: 'Error interno del servidor' }); }
}
