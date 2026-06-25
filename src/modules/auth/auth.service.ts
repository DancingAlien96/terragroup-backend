import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/prisma.js';
import type { UsuarioModel } from '../../generated/prisma/models.js';

export interface UserWithPlan {
  id: number;
  empresa_id: number;
  nombre: string;
  email: string;
  username: string;
  rol: string;
  empresa_nombre: string;
  plan: string;
  secciones_permitidas: string | null;
  estado_suscripcion: string;     // 'trial' | 'pagada' | 'pago_fallido' | 'cancelada' | 'pendiente'
  trial_fin: Date | null;
}

export function findUserByUsername(username: string) {
  return prisma.usuario.findUnique({ where: { username } });
}

export async function getUserWithPlan(userId: number): Promise<UserWithPlan | null> {
  const u = await prisma.usuario.findUnique({
    where: { id: userId },
    include: { empresa: { include: { plan: true } } },
  });
  if (!u) return null;
  return {
    id:                   u.id,
    empresa_id:           u.empresaId,
    nombre:               u.nombre,
    email:                u.email,
    username:             u.username,
    rol:                  u.rol,
    empresa_nombre:       u.empresa.nombre,
    plan:                 u.empresa.plan.nombre,
    secciones_permitidas: u.seccionesPermitidas,
    estado_suscripcion:   u.empresa.estadoSuscripcion,
    trial_fin:            u.empresa.trialFin,
  };
}

export function verifyPassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}

/** Lee el secret obligatoriamente — sin fallback. Lanza si falta o es trivial. */
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16 || s === 'secret' || s === 'changeme') {
    throw new Error(
      'JWT_SECRET no está configurado o es inseguro. Define una cadena aleatoria de al menos 16 caracteres en el entorno.',
    );
  }
  return s;
}

export function signJwt(user: Pick<UsuarioModel, 'id' | 'empresaId' | 'rol' | 'username'>) {
  const payload = {
    sub:       user.id,
    empresaId: user.empresaId,
    rol:       user.rol,
    username:  user.username,
  };
  return jwt.sign(payload, getJwtSecret() as jwt.Secret, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
}

export function parseJwt(token: string) {
  return jwt.verify(token, getJwtSecret() as jwt.Secret);
}
