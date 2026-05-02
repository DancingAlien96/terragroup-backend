import { NextFunction, Request, Response } from 'express';

export function superadminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.user?.rol !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Acceso restringido a super-administradores' });
  }
  next();
}
