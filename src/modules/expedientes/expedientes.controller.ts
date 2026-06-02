import { Request, Response } from 'express';
import * as svc from './expedientes.service.js';

export async function list(req: Request, res: Response) {
  try {
    const empresaId = req.user!.empresaId;
    // Acepta ambos nombres para compatibilidad con frontend en transición
    const ventaId = Number(req.query.venta_id ?? req.query.cliente_id);
    if (!ventaId) {
      res.status(400).json({ success: false, message: 'venta_id requerido' });
      return;
    }
    const data = await svc.listExpedientes(empresaId, ventaId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const empresaId = req.user!.empresaId;
    const ventaId = Number(req.body.venta_id ?? req.body.cliente_id);
    const { nombre, archivo_url } = req.body;
    if (!ventaId || !nombre || !archivo_url) {
      res.status(400).json({ success: false, message: 'venta_id, nombre y archivo_url son requeridos' });
      return;
    }
    const data = await svc.createExpediente(empresaId, ventaId, nombre, archivo_url);
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    if (typeof err?.message === 'string' && err.message.includes('Límite alcanzado')) {
      res.status(409).json({ success: false, message: err.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const ok = await svc.deleteExpediente(Number(req.params.id), req.user!.empresaId);
    if (!ok) { res.status(404).json({ success: false, message: 'No encontrado' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}
