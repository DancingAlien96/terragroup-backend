import prisma from '../../config/prisma.js';

export async function listNotificaciones(empresaId: number) {
  const rows = await prisma.notificacion.findMany({
    where:   { empresaId },
    include: { usuario: { select: { nombre: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((n) => ({ ...n, usuario_nombre: n.usuario.nombre }));
}

export async function getNotificacion(id: number, empresaId: number) {
  const n = await prisma.notificacion.findFirst({
    where:   { id, empresaId },
    include: { usuario: { select: { nombre: true } } },
  });
  return n ? { ...n, usuario_nombre: n.usuario.nombre } : null;
}

export async function createNotificacion(
  empresaId: number,
  data: { usuario_id: number; titulo: string; mensaje: string },
) {
  const created = await prisma.notificacion.create({
    data: { empresaId, usuarioId: data.usuario_id, titulo: data.titulo, mensaje: data.mensaje },
    include: { usuario: { select: { nombre: true } } },
  });
  return { ...created, usuario_nombre: created.usuario.nombre };
}

export async function marcarLeida(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.notificacion.updateMany({
    where: { id, empresaId },
    data:  { leida: true },
  });
  return result.count > 0;
}

export async function deleteNotificacion(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.notificacion.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
