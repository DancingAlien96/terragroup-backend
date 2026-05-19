import prisma from '../../config/prisma.js';

export function listExpedientes(empresaId: number, ventaId: number) {
  return prisma.expediente.findMany({
    where:   { empresaId, ventaId },
    orderBy: { createdAt: 'desc' },
  });
}

export function createExpediente(
  empresaId: number,
  ventaId: number,
  nombre: string,
  archivoUrl: string,
) {
  return prisma.expediente.create({
    data: { empresaId, ventaId, nombre, archivoUrl },
  });
}

export async function deleteExpediente(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.expediente.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
