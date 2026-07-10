import prisma from '../../config/prisma.js';
import { EstadoLote } from '../../generated/prisma/enums.js';

/** Devuelve el id del proyecto default ("Principal") de la empresa, o null. */
async function proyectoDefaultId(empresaId: number): Promise<number | null> {
  const p = await prisma.proyecto.findFirst({
    where:   { empresaId, activo: true },
    orderBy: { id: 'asc' },
    select:  { id: true },
  });
  return p?.id ?? null;
}

export function listLotes(empresaId: number, proyectoId?: number) {
  return prisma.lote.findMany({
    where:   { empresaId, ...(proyectoId ? { proyectoId } : {}) },
    include: { proyecto: { select: { id: true, nombre: true } } },
    orderBy: { clave: 'asc' },
  });
}

export function getLote(id: number, empresaId: number) {
  return prisma.lote.findFirst({
    where:   { id, empresaId },
    include: { proyecto: { select: { id: true, nombre: true } } },
  });
}

export async function createLote(
  empresaId: number,
  data: {
    clave: string; manzana?: string; numero?: string;
    superficie?: number; precio_venta?: number; estado?: EstadoLote;
    proyecto_id?: number;
  },
) {
  // Si el cliente no especifica proyecto, usa el primer proyecto activo de
  // la empresa (retro-compat: forms viejos no lo mandan).
  const proyectoId = data.proyecto_id ?? await proyectoDefaultId(empresaId);
  if (!proyectoId) {
    throw new Error('La empresa no tiene proyectos configurados');
  }
  // Verifica que el proyecto pertenezca a la empresa (defensa contra IDOR).
  const p = await prisma.proyecto.findFirst({
    where:  { id: proyectoId, empresaId },
    select: { id: true },
  });
  if (!p) throw new Error('El proyecto no existe o no pertenece a esta empresa');

  return prisma.lote.create({
    data: {
      empresaId,
      proyectoId,
      clave:       data.clave,
      manzana:     data.manzana ?? null,
      numero:      data.numero ?? null,
      superficie:  data.superficie ?? null,
      precioVenta: data.precio_venta ?? null,
      estado:      data.estado ?? EstadoLote.disponible,
    },
  });
}

export async function updateLote(
  id: number,
  empresaId: number,
  data: Partial<{
    clave: string; manzana: string; numero: string;
    superficie: number; precio_venta: number; estado: EstadoLote;
    proyecto_id: number;
  }>,
) {
  const lote = await prisma.lote.findFirst({ where: { id, empresaId } });
  if (!lote) return null;

  const payload: Record<string, unknown> = {};
  if (data.clave !== undefined)        payload.clave       = data.clave;
  if (data.manzana !== undefined)      payload.manzana     = data.manzana;
  if (data.numero !== undefined)       payload.numero      = data.numero;
  if (data.superficie !== undefined)   payload.superficie  = data.superficie;
  if (data.precio_venta !== undefined) payload.precioVenta = data.precio_venta;
  if (data.estado !== undefined)       payload.estado      = data.estado;
  if (data.proyecto_id !== undefined) {
    const p = await prisma.proyecto.findFirst({
      where:  { id: data.proyecto_id, empresaId },
      select: { id: true },
    });
    if (!p) throw new Error('El proyecto no existe o no pertenece a esta empresa');
    payload.proyectoId = data.proyecto_id;
  }

  if (Object.keys(payload).length === 0) return lote;
  return prisma.lote.update({ where: { id }, data: payload });
}

export async function deleteLote(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.lote.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
