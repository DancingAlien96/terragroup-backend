import prisma from '../../config/prisma.js';

/**
 * Lista los proyectos de una empresa, ordenados por creación reciente primero.
 * Incluye conteo de lotes por proyecto para mostrar en la UI.
 */
export async function listProyectos(empresaId: number) {
  const rows = await prisma.proyecto.findMany({
    where:   { empresaId },
    include: { _count: { select: { lotes: true } } },
    orderBy: [{ activo: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map((p) => ({
    id:            p.id,
    empresa_id:    p.empresaId,
    nombre:        p.nombre,
    descripcion:   p.descripcion,
    ubicacion:     p.ubicacion,
    activo:        p.activo,
    total_lotes:   p._count.lotes,
    created_at:    p.createdAt,
    updated_at:    p.updatedAt,
  }));
}

export async function getProyecto(id: number, empresaId: number) {
  const p = await prisma.proyecto.findFirst({
    where:   { id, empresaId },
    include: { _count: { select: { lotes: true } } },
  });
  if (!p) return null;
  return {
    id: p.id, empresa_id: p.empresaId, nombre: p.nombre,
    descripcion: p.descripcion, ubicacion: p.ubicacion, activo: p.activo,
    total_lotes: p._count.lotes,
    created_at: p.createdAt, updated_at: p.updatedAt,
  };
}

/**
 * Calcula el máximo de proyectos permitidos para la empresa según su plan
 * más los extras que haya comprado. Uso para validar antes de crear.
 */
export async function limitesProyectos(empresaId: number): Promise<{
  actuales: number; permitidos: number; puede_crear: boolean;
}> {
  const [empresa, actuales] = await Promise.all([
    prisma.empresa.findUnique({
      where:  { id: empresaId },
      select: { proyectosExtra: true, plan: { select: { maxProyectos: true } } },
    }),
    prisma.proyecto.count({ where: { empresaId, activo: true } }),
  ]);
  const permitidos = (empresa?.plan.maxProyectos ?? 0) + (empresa?.proyectosExtra ?? 0);
  return { actuales, permitidos, puede_crear: actuales < permitidos };
}

export async function createProyecto(
  empresaId: number,
  data: { nombre: string; descripcion?: string | null; ubicacion?: string | null },
) {
  const nombre = data.nombre.trim();
  if (nombre.length < 2) throw new Error('El nombre del proyecto es muy corto');

  // Validación de límite del plan
  const { permitidos, actuales, puede_crear } = await limitesProyectos(empresaId);
  if (!puede_crear) {
    throw Object.assign(
      new Error(`Alcanzaste el límite de tu plan (${actuales}/${permitidos} proyectos). Actualiza tu plan o compra un proyecto extra.`),
      { code: 'PLAN_LIMIT_REACHED' },
    );
  }

  const created = await prisma.proyecto.create({
    data: {
      empresaId, nombre,
      descripcion: data.descripcion ?? null,
      ubicacion:   data.ubicacion   ?? null,
    },
  });
  return getProyecto(created.id, empresaId);
}

export async function updateProyecto(
  id: number,
  empresaId: number,
  data: Partial<{ nombre: string; descripcion: string | null; ubicacion: string | null; activo: boolean }>,
) {
  const p = await prisma.proyecto.findFirst({ where: { id, empresaId } });
  if (!p) return null;

  const payload: Record<string, unknown> = {};
  if (data.nombre !== undefined) {
    const trimmed = data.nombre.trim();
    if (trimmed.length < 2) throw new Error('El nombre del proyecto es muy corto');
    payload.nombre = trimmed;
  }
  if (data.descripcion !== undefined) payload.descripcion = data.descripcion;
  if (data.ubicacion   !== undefined) payload.ubicacion   = data.ubicacion;
  if (data.activo      !== undefined) payload.activo      = data.activo;

  if (Object.keys(payload).length === 0) return getProyecto(id, empresaId);
  await prisma.proyecto.update({ where: { id }, data: payload });
  return getProyecto(id, empresaId);
}

/**
 * Elimina el proyecto. Bloqueado si tiene lotes asociados (onDelete Restrict
 * en el schema lo previene también a nivel BD). Devuelve false si no existe
 * o si tiene lotes.
 */
export async function deleteProyecto(id: number, empresaId: number): Promise<{
  ok: boolean; reason?: string;
}> {
  const p = await prisma.proyecto.findFirst({
    where:   { id, empresaId },
    include: { _count: { select: { lotes: true } } },
  });
  if (!p) return { ok: false, reason: 'not_found' };
  if (p._count.lotes > 0) {
    return { ok: false, reason: `Tiene ${p._count.lotes} lote(s) asociados. Elimina los lotes o desactívalo.` };
  }
  await prisma.proyecto.delete({ where: { id } });
  return { ok: true };
}
