import prisma from '../../config/prisma.js';
import { EstadoCuenta } from '../../generated/prisma/enums.js';

export function listPropietarios(empresaId: number) {
  return prisma.propietario.findMany({
    where:   { empresaId },
    orderBy: { nombre: 'asc' },
  });
}

export function getPropietario(id: number, empresaId: number) {
  return prisma.propietario.findFirst({ where: { id, empresaId } });
}

export function createPropietario(
  empresaId: number,
  data: { nombre: string; telefono?: string; email?: string; direccion?: string },
) {
  return prisma.propietario.create({
    data: {
      empresaId,
      nombre:    data.nombre,
      telefono:  data.telefono ?? null,
      email:     data.email ?? null,
      direccion: data.direccion ?? null,
    },
  });
}

export async function updatePropietario(
  id: number,
  empresaId: number,
  data: Partial<{ nombre: string; telefono: string; email: string; direccion: string; estado_cuenta: EstadoCuenta }>,
) {
  const propietario = await prisma.propietario.findFirst({ where: { id, empresaId } });
  if (!propietario) return null;

  const payload: Record<string, unknown> = {};
  if (data.nombre !== undefined)        payload.nombre       = data.nombre;
  if (data.telefono !== undefined)      payload.telefono     = data.telefono;
  if (data.email !== undefined)         payload.email        = data.email;
  if (data.direccion !== undefined)     payload.direccion    = data.direccion;
  if (data.estado_cuenta !== undefined) payload.estadoCuenta = data.estado_cuenta;

  if (Object.keys(payload).length === 0) return propietario;
  return prisma.propietario.update({ where: { id }, data: payload });
}

export async function deletePropietario(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.propietario.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
