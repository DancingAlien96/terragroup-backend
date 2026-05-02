import { Request, Response } from 'express';
import { getCarteraVencida } from './cartera.service.js';

export async function list(req: Request, res: Response) {
  try {
    const data = await getCarteraVencida(req.user!.empresaId);
    return res.json({ success: true, data });
  } catch (e) { return res.status(500).json({ success: false, message: String(e) }); }
}
