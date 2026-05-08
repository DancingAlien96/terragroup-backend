import { Request, Response } from 'express';
import * as svc from './usuarios.service.js';
import { sendBienvenidaUsuario } from '../../config/mailer.js';

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

    // Send welcome email (fire-and-forget)
    sendBienvenidaUsuario({ to: email, nombre, username, password, rol }).catch(() => {});

    return res.status(201).json({ success: true, data: user });
  } catch (e: any) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email o username ya existe' });
    }
    return res.status(500).json({ success: false, message: String(e) });
  }
}

export async function update(req: Request, res: Response) {
  const targetId = Number(req.params.id);
  const me = req.user!;
  // Prevent self-deactivation
  if (targetId === me.id && req.body.activo === false) {
    return res.status(400).json({ success: false, message: 'No puedes desactivarte a ti mismo' });
  }
  // Prevent self rol change
  if (targetId === me.id && req.body.rol && req.body.rol !== me.rol) {
    return res.status(400).json({ success: false, message: 'No puedes cambiar tu propio rol' });
  }
  try {
    const user = await svc.updateUsuario(targetId, me.empresaId, req.body);
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
  const targetId = Number(req.params.id);
  if (targetId === req.user!.id) {
    return res.status(400).json({ success: false, message: 'No puedes eliminar tu propia cuenta' });
  }
  try {
    const deleted = await svc.deleteUsuario(targetId, req.user!.empresaId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    return res.json({ success: true, message: 'Usuario eliminado' });
  } catch (e) {
    return res.status(500).json({ success: false, message: String(e) });
  }
}
