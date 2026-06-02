import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16 || s === 'secret' || s === 'changeme') {
    throw new Error('JWT_SECRET no está configurado o es inseguro.');
  }
  return s;
}

interface JwtPayload {
  sub: number;
  empresaId: number;
  rol: string;
  username: string;
  iat?: number;
  exp?: number;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid authorization header' });
  }

  const token = authorization.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, getJwtSecret()) as unknown as JwtPayload;
    req.user = {
      id: payload.sub,
      empresaId: payload.empresaId,
      rol: payload.rol,
      username: payload.username,
    };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}
