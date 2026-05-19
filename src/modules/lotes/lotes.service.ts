import prisma from '../../config/prisma.js';
import { EstadoLote } from '../../generated/prisma/enums.js';

export function listLotes(empresaId: number) {
  return prisma.lote.findMany({
    where:   { empresaId },
    orderBy: { clave: 'asc' },
  });
}

export function getLote(id: number, empresaId: number) {
  return prisma.lote.findFirst({ where: { id, empresaId } });
}

export function createLote(
  empresaId: number,
  data: { clave: string; manzana?: string; numero?: string; superficie?: number; precio_venta?: number; estado?: EstadoLote },
) {
  return prisma.lote.create({
    data: {
      empresaId,
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
  data: Partial<{ clave: string; manzana: string; numero: string; superficie: number; precio_venta: number; estado: EstadoLote }>,
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

  if (Object.keys(payload).length === 0) return lote;
  return prisma.lote.update({ where: { id }, data: payload });
}

export async function deleteLote(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.lote.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
