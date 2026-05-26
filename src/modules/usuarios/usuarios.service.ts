import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma.js';
import { Rol } from '../../generated/prisma/enums.js';

const SELECT_SAFE = {
  id: true, empresaId: true, nombre: true, email: true,
  username: true, rol: true, activo: true,
  seccionesPermitidas: true,
  createdAt: true, updatedAt: true,
} as const;

// Convierte camelCase de Prisma a snake_case que espera el frontend
function shape(u: any) {
  return {
    id:                   u.id,
    empresa_id:           u.empresaId,
    nombre:               u.nombre,
    email:                u.email,
    username:             u.username,
    rol:                  u.rol,
    activo:               u.activo,
    secciones_permitidas: u.seccionesPermitidas ?? null,
    created_at:           u.createdAt,
    updated_at:           u.updatedAt,
  };
}

export async function listUsuarios(empresaId: number) {
  const rows = await prisma.usuario.findMany({
    where:  { empresaId },
    select: SELECT_SAFE,
    orderBy: { nombre: 'asc' },
  });
  return rows.map(shape);
}

export async function getUsuario(id: number, empresaId: number) {
  const u = await prisma.usuario.findFirst({
    where:  { id, empresaId },
    select: SELECT_SAFE,
  });
  return u ? shape(u) : null;
}

export async function createUsuario(
  empresaId: number,
  data: { nombre: string; email: string; username: string; password: string; rol: string; seccionesPermitidas?: string | null },
) {
  const hashed = await bcrypt.hash(data.password, 10);
  const u = await prisma.usuario.create({
    data: {
      empresaId,
      nombre:              data.nombre,
      email:               data.email,
      username:            data.username,
      password:            hashed,
      rol:                 data.rol as Rol,
      seccionesPermitidas: data.seccionesPermitidas ?? null,
    },
    select: SELECT_SAFE,
  });
  return shape(u);
}

export async function updateUsuario(
  id: number,
  empresaId: number,
  data: Partial<{
    nombre: string; email: string; username: string; rol: string;
    activo: boolean; password: string; seccionesPermitidas: string | null;
  }>,
) {
  const existing = await prisma.usuario.findFirst({ where: { id, empresaId } });
  if (!existing) return null;

  const payload: Record<string, unknown> = {};
  if (data.nombre !== undefined)              payload.nombre              = data.nombre;
  if (data.email !== undefined)               payload.email               = data.email;
  if (data.username !== undefined)            payload.username            = data.username;
  if (data.rol !== undefined)                 payload.rol                 = data.rol;
  if (data.activo !== undefined)              payload.activo              = data.activo;
  if (data.password !== undefined)            payload.password            = await bcrypt.hash(data.password, 10);
  if (data.seccionesPermitidas !== undefined) payload.seccionesPermitidas = data.seccionesPermitidas;

  if (Object.keys(payload).length === 0) {
    return getUsuario(id, empresaId);
  }
  const u = await prisma.usuario.update({ where: { id }, data: payload, select: SELECT_SAFE });
  return shape(u);
}

export async function deleteUsuario(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.usuario.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
