import type { Request, Response } from 'express';
import * as svc from './croquis.service.js';
import { absolutizeUploadUrl } from '../../utils/files.js';

export async function getPorProyecto(req: Request, res: Response) {
  try {
    const proyectoId = Number(req.params.proyectoId);
    if (!Number.isFinite(proyectoId)) return res.status(400).json({ success: false, message: 'proyectoId inválido' });
    const result = await svc.getCroquisPorProyecto(proyectoId, req.user!.empresaId);
    if ('notFound' in result) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[croquis get]', err);
    return res.status(500).json({ success: false, message: 'Error al obtener croquis' });
  }
}

export async function upsert(req: Request, res: Response) {
  try {
    const proyectoId = Number(req.params.proyectoId);
    if (!Number.isFinite(proyectoId)) return res.status(400).json({ success: false, message: 'proyectoId inválido' });
    const c = await svc.upsertCroquis(proyectoId, req.user!.empresaId, req.body ?? {});
    if (!c) return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    return res.json({ success: true, data: c });
  } catch (err) {
    if (err instanceof Error) return res.status(400).json({ success: false, message: err.message });
    console.error('[croquis upsert]', err);
    return res.status(500).json({ success: false, message: 'Error al guardar croquis' });
  }
}

export async function updateContacto(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'id inválido' });
    const c = await svc.updateContacto(id, req.user!.empresaId, req.body ?? {});
    if (!c) return res.status(404).json({ success: false, message: 'Croquis no encontrado' });
    return res.json({ success: true, data: c });
  } catch (err) {
    console.error('[croquis updateContacto]', err);
    return res.status(500).json({ success: false, message: 'Error al actualizar contacto' });
  }
}

export async function activarPublico(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'id inválido' });
    const c = await svc.activarPublico(id, req.user!.empresaId);
    if (!c) return res.status(404).json({ success: false, message: 'Croquis no encontrado' });
    return res.json({ success: true, data: c });
  } catch (err) {
    console.error('[croquis activarPublico]', err);
    return res.status(500).json({ success: false, message: 'Error al activar vista pública' });
  }
}

export async function desactivarPublico(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'id inválido' });
    const c = await svc.desactivarPublico(id, req.user!.empresaId);
    if (!c) return res.status(404).json({ success: false, message: 'Croquis no encontrado' });
    return res.json({ success: true, data: c });
  } catch (err) {
    console.error('[croquis desactivarPublico]', err);
    return res.status(500).json({ success: false, message: 'Error al desactivar vista pública' });
  }
}

export async function regenerarToken(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'id inválido' });
    const c = await svc.regenerarToken(id, req.user!.empresaId);
    if (!c) return res.status(404).json({ success: false, message: 'Croquis no encontrado' });
    return res.json({ success: true, data: c });
  } catch (err) {
    console.error('[croquis regenerarToken]', err);
    return res.status(500).json({ success: false, message: 'Error al regenerar token' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'id inválido' });
    const r = await svc.deleteCroquis(id, req.user!.empresaId);
    if (!r.ok) return res.status(404).json({ success: false, message: 'Croquis no encontrado' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[croquis delete]', err);
    return res.status(500).json({ success: false, message: 'Error al eliminar croquis' });
  }
}

export async function setPin(req: Request, res: Response) {
  try {
    const loteId = Number(req.params.loteId);
    if (!Number.isFinite(loteId)) return res.status(400).json({ success: false, message: 'loteId inválido' });
    const { punto_x, punto_y } = req.body ?? {};
    const l = await svc.setPinLote(loteId, req.user!.empresaId, { punto_x, punto_y });
    if (!l) return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    return res.json({ success: true, data: l });
  } catch (err) {
    if (err instanceof Error) return res.status(400).json({ success: false, message: err.message });
    console.error('[croquis setPin]', err);
    return res.status(500).json({ success: false, message: 'Error al guardar pin' });
  }
}

export async function quitarPin(req: Request, res: Response) {
  try {
    const loteId = Number(req.params.loteId);
    if (!Number.isFinite(loteId)) return res.status(400).json({ success: false, message: 'loteId inválido' });
    const l = await svc.quitarPinLote(loteId, req.user!.empresaId);
    if (!l) return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    return res.json({ success: true, data: l });
  } catch (err) {
    console.error('[croquis quitarPin]', err);
    return res.status(500).json({ success: false, message: 'Error al quitar pin' });
  }
}

export async function updateVisibilidadPublicaLote(req: Request, res: Response) {
  try {
    const loteId = Number(req.params.loteId);
    if (!Number.isFinite(loteId)) return res.status(400).json({ success: false, message: 'loteId inválido' });
    const l = await svc.updateVisibilidadPublicaLote(loteId, req.user!.empresaId, req.body ?? {});
    if (!l) return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    return res.json({ success: true, data: l });
  } catch (err) {
    console.error('[croquis updateVisibilidad]', err);
    return res.status(500).json({ success: false, message: 'Error al actualizar lote' });
  }
}

export async function getPublico(req: Request, res: Response) {
  try {
    const token = String(req.params.token ?? '');
    const data = await svc.getPublicoPorToken(token);
    if (!data) return res.status(404).json({ success: false, message: 'Croquis no disponible' });
    // Absolutiza URLs de uploads usando el host del request — evita que el
    // frontend tenga que reconstruir la URL con env vars y sea sensible a
    // reverse-proxy / mixed-content / typos.
    return res.json({
      success: true,
      data: {
        ...data,
        imagen_url:           absolutizeUploadUrl(data.imagen_url,           req) ?? data.imagen_url,
        proyecto_portada_url: absolutizeUploadUrl(data.proyecto_portada_url, req),
      },
    });
  } catch (err) {
    console.error('[croquis publico]', err);
    return res.status(500).json({ success: false, message: 'Error al obtener croquis público' });
  }
}
