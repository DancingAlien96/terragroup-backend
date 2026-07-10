import { Request, Response } from 'express';
import * as svc from './proyectos.service.js';

export async function list(req: Request, res: Response) {
  try {
    const items = await svc.listProyectos(req.user!.empresaId);
    return res.json({ success: true, data: items });
  } catch (err) {
    console.error('[proyectos list]', err);
    return res.status(500).json({ success: false, message: 'Error al obtener proyectos' });
  }
}

/** Devuelve conteo actual vs permitidos por plan — usado para deshabilitar UI. */
export async function limites(req: Request, res: Response) {
  try {
    const info = await svc.limitesProyectos(req.user!.empresaId);
    return res.json({ success: true, data: info });
  } catch (err) {
    console.error('[proyectos limites]', err);
    return res.status(500).json({ success: false, message: 'Error al consultar límites' });
  }
}

export async function get(req: Request, res: Response) {
  try {
    const p = await svc.getProyecto(Number(req.params.id), req.user!.empresaId);
    if (!p) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    return res.json({ success: true, data: p });
  } catch (err) {
    console.error('[proyectos get]', err);
    return res.status(500).json({ success: false, message: 'Error al obtener proyecto' });
  }
}

export async function create(req: Request, res: Response) {
  const { nombre, descripcion, ubicacion } = req.body;
  if (!nombre) return res.status(400).json({ success: false, message: 'El nombre es requerido' });
  try {
    const created = await svc.createProyecto(req.user!.empresaId, { nombre, descripcion, ubicacion });
    return res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    if (err?.code === 'PLAN_LIMIT_REACHED') {
      return res.status(402).json({ success: false, code: 'PLAN_LIMIT_REACHED', message: err.message });
    }
    if (err?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Ya existe un proyecto con ese nombre en esta empresa' });
    }
    if (err instanceof Error) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('[proyectos create]', err);
    return res.status(500).json({ success: false, message: 'Error al crear proyecto' });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const updated = await svc.updateProyecto(Number(req.params.id), req.user!.empresaId, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Ya existe otro proyecto con ese nombre' });
    }
    if (err instanceof Error) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('[proyectos update]', err);
    return res.status(500).json({ success: false, message: 'Error al actualizar proyecto' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const result = await svc.deleteProyecto(Number(req.params.id), req.user!.empresaId);
    if (!result.ok) {
      if (result.reason === 'not_found') return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
      return res.status(400).json({ success: false, message: result.reason });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[proyectos delete]', err);
    return res.status(500).json({ success: false, message: 'Error al eliminar proyecto' });
  }
}
