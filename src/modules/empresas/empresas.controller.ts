import { Request, Response } from 'express';
import * as EmpresasService from './empresas.service.js';

export async function register(req: Request, res: Response) {
  const { empresa_nombre, empresa_email, empresa_telefono, plan_id, nombre_admin, email_admin, username_admin, password_admin } = req.body;

  if (!empresa_nombre || !nombre_admin || !email_admin || !username_admin || !password_admin) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }

  try {
    const result = await EmpresasService.registerEmpresa({
      empresa_nombre, empresa_email, empresa_telefono,
      plan_id: plan_id ? Number(plan_id) : undefined,
      nombre_admin, email_admin, username_admin, password_admin,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El email o username ya está registrado' });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: err?.message ?? 'Error al registrar empresa' });
  }
}

/**
 * Endpoint público (sin auth) usado por la página /register/exito para
 * hacer polling hasta que el webhook activa la empresa. Solo devuelve `activo`.
 */
export async function getEstadoEmpresa(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'id inválido' });
    const empresa = await EmpresasService.getEmpresaEstado(id);
    if (!empresa) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
    return res.json({ success: true, data: empresa });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al consultar estado' });
  }
}

export async function listEmpresas(_req: Request, res: Response) {
  try {
    const data = await EmpresasService.listEmpresas();
    return res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al obtener empresas' });
  }
}

export async function getEmpresa(req: Request, res: Response) {
  try {
    const empresa = await EmpresasService.getEmpresa(Number(req.params.id));
    if (!empresa) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
    return res.json({ success: true, data: empresa });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al obtener empresa' });
  }
}

export async function toggleEmpresa(req: Request, res: Response) {
  try {
    await EmpresasService.toggleEmpresa(Number(req.params.id));
    return res.json({ success: true, message: 'Estado actualizado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al actualizar empresa' });
  }
}

export async function updateEmpresaPlan(req: Request, res: Response) {
  const { plan_id } = req.body;
  if (!plan_id) return res.status(400).json({ success: false, message: 'plan_id requerido' });
  try {
    await EmpresasService.updateEmpresaPlan(Number(req.params.id), Number(plan_id));
    return res.json({ success: true, message: 'Plan actualizado' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al actualizar plan' });
  }
}

export async function updateEmpresa(req: Request, res: Response) {
  const { nombre, email, telefono, rfc, fecha_vence } = req.body;
  try {
    await EmpresasService.updateEmpresa(Number(req.params.id), { nombre, email, telefono, rfc, fecha_vence });
    return res.json({ success: true, message: 'Empresa actualizada' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al actualizar empresa' });
  }
}

export async function getGlobalStats(_req: Request, res: Response) {
  try {
    const data = await EmpresasService.getGlobalStats();
    return res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
}
