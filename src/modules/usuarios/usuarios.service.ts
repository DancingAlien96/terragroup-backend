import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import { Rol } from '../../generated/prisma/enums.js';

const SELECT_SAFE = {
  id: true, empresaId: true, nombre: true, email: true,
  username: true, rol: true, activo: true, createdAt: true, updatedAt: true,
} as const;

export function listUsuarios(empresaId: number) {
  return prisma.usuario.findMany({
    where:  { empresaId },
    select: SELECT_SAFE,
    orderBy: { nombre: 'asc' },
  });
}

export function getUsuario(id: number, empresaId: number) {
  return prisma.usuario.findFirst({
    where:  { id, empresaId },
    select: SELECT_SAFE,
  });
}

export async function createUsuario(
  empresaId: number,
  data: { nombre: string; email: string; username: string; password: string; rol: string },
) {
  const hashed = await bcrypt.hash(data.password, 10);
  return prisma.usuario.create({
    data: {
      empresaId,
      nombre:   data.nombre,
      email:    data.email,
      username: data.username,
      password: hashed,
      rol:      data.rol as Rol,
    },
    select: SELECT_SAFE,
  });
}

export async function updateUsuario(
  id: number,
  empresaId: number,
  data: Partial<{ nombre: string; email: string; username: string; rol: string; activo: boolean; password: string }>,
) {
  const existing = await prisma.usuario.findFirst({ where: { id, empresaId } });
  if (!existing) return null;

  const payload: Record<string, unknown> = {};
  if (data.nombre !== undefined)   payload.nombre   = data.nombre;
  if (data.email !== undefined)    payload.email    = data.email;
  if (data.username !== undefined) payload.username = data.username;
  if (data.rol !== undefined)      payload.rol      = data.rol;
  if (data.activo !== undefined)   payload.activo   = data.activo;
  if (data.password !== undefined) payload.password = await bcrypt.hash(data.password, 10);

  if (Object.keys(payload).length === 0) {
    return getUsuario(id, empresaId);
  }
  return prisma.usuario.update({ where: { id }, data: payload, select: SELECT_SAFE });
}

export async function deleteUsuario(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.usuario.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
