import prisma from '../../config/prisma.js';

export const MAX_EXPEDIENTES_POR_VENTA = 3;

export function listExpedientes(empresaId: number, ventaId: number) {
  return prisma.expediente.findMany({
    where:   { empresaId, ventaId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createExpediente(
  empresaId: number,
  ventaId: number,
  nombre: string,
  archivoUrl: string,
) {
  const count = await prisma.expediente.count({ where: { empresaId, ventaId } });
  if (count >= MAX_EXPEDIENTES_POR_VENTA) {
    throw new Error(`Límite alcanzado: máximo ${MAX_EXPEDIENTES_POR_VENTA} documentos por cliente.`);
  }
  return prisma.expediente.create({
    data: { empresaId, ventaId, nombre, archivoUrl },
  });
}

export async function deleteExpediente(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.expediente.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
