import { Request, Response } from 'express';
import * as svc from './usuarios.service.js';

export async function list(req: Request, res: Response) {
  try {
    const users = await svc.listUsuarios(req.user!.empresaId);
    return res.json({ success: true, data: users });
  } catch (e) {
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function get(req: Request, res: Response) {
  try {
    const user = await svc.getUsuario(Number(req.params.id), req.user!.empresaId);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    return res.json({ success: true, data: user });
  } catch (e) {
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function create(req: Request, res: Response) {
  const { nombre, email, username, password, rol } = req.body;
  if (!nombre || !email || !username || !password || !rol) {
    return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
  }
  try {
    const user = await svc.createUsuario(req.user!.empresaId, { nombre, email, username, password, rol });
    return res.status(201).json({ success: true, data: user });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email o username ya existe' });
    }
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const user = await svc.updateUsuario(Number(req.params.id), req.user!.empresaId, req.body);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    return res.json({ success: true, data: user });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email o username ya existe' });
    }
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const deleted = await svc.deleteUsuario(Number(req.params.id), req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    return res.json({ success: true, message: 'Usuario eliminado' });
  } catch (e) {
    return res.status(500).json({ success: false, message: String(e) });
  }
}
