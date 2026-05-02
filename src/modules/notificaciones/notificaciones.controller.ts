import { Request, Response } from 'express';
import * as svc from './notificaciones.service.js';

export async function list(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listNotificaciones(req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function create(req: Request, res: Response) {
  const { usuario_id, titulo, mensaje } = req.body;
  if (!usuario_id || !titulo || !mensaje) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const item = await svc.createNotificacion(req.user!.empresaId, { usuario_id, titulo, mensaje });
    return res.status(201).json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function leer(req: Request, res: Response) {
  try {
    const ok = await svc.marcarLeida(Number(req.params.id), req.user!.empresaId);
    if (!ok) return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
    return res.json({ success: true, message: 'Marcada como leída' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await svc.deleteNotificacion(Number(req.params.id), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
    return res.json({ success: true, message: 'Notificación eliminada' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}
