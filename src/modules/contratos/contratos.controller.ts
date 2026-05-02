import { Request, Response } from 'express';
import * as svc from './contratos.service.js';

export async function list(req: Request, res: Response) {
  try {
    return res.json({ success: true, data: await svc.listContratos(req.user!.empresaId) });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function get(req: Request, res: Response) {
  try {
    const item = await svc.getContrato(Number(req.params.id), req.user!.empresaId);
    if (!item) return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function create(req: Request, res: Response) {
  const { propietario_id, lote_id, vendedor_id, precio_total, enganche, mensualidad, num_mensualidades, fecha_inicio } = req.body;
  if (!propietario_id || !lote_id || !vendedor_id || !precio_total || !fecha_inicio) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const item = await svc.createContrato(req.user!.empresaId, {
      propietario_id, lote_id, vendedor_id, precio_total,
      enganche: enganche ?? 0, mensualidad: mensualidad ?? 0,
      num_mensualidades: num_mensualidades ?? 0, fecha_inicio,
      fecha_fin: req.body.fecha_fin,
    });
    return res.status(201).json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function update(req: Request, res: Response) {
  try {
    const item = await svc.updateContrato(Number(req.params.id), req.user!.empresaId, req.body);
    if (!item) return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
    return res.json({ success: true, data: item });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await svc.deleteContrato(Number(req.params.id), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Contrato no encontrado' });
    return res.json({ success: true, message: 'Contrato eliminado' });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}
