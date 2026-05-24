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
  };
}

export function verifyPassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}

export function signJwt(user: Pick<UsuarioModel, 'id' | 'empresaId' | 'rol' | 'username'>) {
  const payload = {
    sub:       user.id,
    empresaId: user.empresaId,
    rol:       user.rol,
    username:  user.username,
  };
  const secret = process.env.JWT_SECRET ?? 'secret';
  return jwt.sign(payload, secret as jwt.Secret, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
}

export function parseJwt(token: string) {
  const secret = process.env.JWT_SECRET ?? 'secret';
  return jwt.verify(token, secret as jwt.Secret);
}
