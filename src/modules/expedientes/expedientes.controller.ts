import { Request, Response } from 'express';
import * as svc from './expedientes.service.js';

export async function list(req: Request, res: Response) {
  try {
    const empresaId = req.user!.empresa_id;
    const clienteId = Number(req.query.cliente_id);
    if (!clienteId) {
      res.status(400).json({ success: false, message: 'cliente_id requerido' });
      return;
    }
    const data = await svc.listExpedientes(empresaId, clienteId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
}

export async function create(req: Request, res: Response) {
  try {
    const empresaId = req.user!.empresa_id;
    const { cliente_id, nombre, archivo_url } = req.body;
    if (!cliente_id || !nombre || !archivo_url) {
      res.status(400).json({ success: false, message: 'cliente_id, nombre y archivo_url son requeridos' });
      return;
    }
    const data = await svc.createExpediente(empresaId, Number(cliente_id), nombre, archivo_url);
    res.status(201).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const empresaId = req.user!.empresa_id;
    const id = Number(req.params.id);
    const ok = await svc.deleteExpediente(id, empresaId);
    if (!ok) { res.status(404).json({ success: false, message: 'No encontrado' }); return; }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
}
