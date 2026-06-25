import { Request, Response } from 'express';
import * as EmpresasService from './empresas.service.js';

export async function register(req: Request, res: Response) {
  const {
    empresa_nombre, empresa_email, empresa_telefono, plan_id,
    nombre_admin, email_admin, username_admin, password_admin,
    acepto_terminos,
  } = req.body;

  if (!empresa_nombre || !nombre_admin || !email_admin || !username_admin || !password_admin) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }

  // Evidencia legal: el cliente debe haber aceptado expresamente. Sin esto el
  // registro no procede, sin importar lo que diga el frontend.
  if (acepto_terminos !== true) {
    return res.status(400).json({
      success: false,
      message: 'Debes aceptar los Términos y la Política de Privacidad para continuar',
    });
  }

  try {
    const result = await EmpresasService.registerEmpresa({
      empresa_nombre, empresa_email, empresa_telefono,
      plan_id: plan_id ? Number(plan_id) : undefined,
      nombre_admin, email_admin, username_admin, password_admin,
      acepto_terminos: true,
    });
    return res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err?.code === 'TRIAL_ALREADY_USED') {
      return res.status(409).json({
        success: false, code: 'TRIAL_ALREADY_USED',
        message: err.message,
      });
    }
    // P2002 = Prisma unique constraint violation. ER_DUP_ENTRY es el code del
    // driver de MySQL; lo dejamos por si algún día bypaseamos Prisma.
    if (err?.code === 'P2002' || err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El email o username ya está registrado' });
    }
    console.error('[register] error inesperado:', err);
    return res.status(500).json({ success: false, message: 'Error al registrar empresa' });
  }
}

/**
 * Devuelve info de la suscripción (trial, días restantes, puede_cancelar)
 * para el admin de la empresa logueada — usado por el banner del dashboard.
 */
export async function getMiSuscripcion(req: Request, res: Response) {
  try {
    const empresaId = req.user?.empresaId;
    if (!empresaId) return res.status(401).json({ success: false, message: 'No autorizado' });
    const info = await EmpresasService.getSuscripcionInfo(empresaId);
    if (!info) return res.status(404).json({ success: false, message: 'Empresa no encontrada' });
    return res.json({ success: true, data: info });
  } catch (err) {
    console.error('[mi-suscripcion]', err);
    return res.status(500).json({ success: false, message: 'Error al obtener suscripción' });
  }
}

/** Cancelar la suscripción de la empresa logueada (solo durante trial). */
export async function cancelarMiSuscripcion(req: Request, res: Response) {
  try {
    const empresaId = req.user?.empresaId;
    if (!empresaId) return res.status(401).json({ success: false, message: 'No autorizado' });
    const result = await EmpresasService.cancelarSuscripcionEmpresa(empresaId);
    if (!result.ok) return res.status(400).json({ success: false, message: result.message });
    return res.json({ success: true });
  } catch (err) {
    console.error('[cancelar-suscripcion]', err);
    return res.status(500).json({ success: false, message: 'Error al cancelar suscripción' });
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
