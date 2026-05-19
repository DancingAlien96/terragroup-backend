import prisma from '../../config/prisma.js';

/* ── Vendedores ───────────────────────────────────────────── */

export async function listVendedores(empresaId: number) {
  const vendedores = await prisma.vendedor.findMany({
    where:   { empresaId },
    include: { comisiones: { select: { montoComision: true } } },
    orderBy: { nombre: 'asc' },
  });
  return vendedores.map((v) => {
    const totalComisiones = v.comisiones.reduce((s, c) => s + Number(c.montoComision), 0);
    const { comisiones: _omit, ...rest } = v;
    return {
      ...rest,
      total_ventas:     v.comisiones.length,
      total_comisiones: totalComisiones,
    };
  });
}

export async function getVendedor(id: number, empresaId: number) {
  const v = await prisma.vendedor.findFirst({
    where:   { id, empresaId },
    include: { comisiones: { select: { montoComision: true } } },
  });
  if (!v) return null;
  const totalComisiones = v.comisiones.reduce((s, c) => s + Number(c.montoComision), 0);
  const { comisiones: _omit, ...rest } = v;
  return { ...rest, total_ventas: v.comisiones.length, total_comisiones: totalComisiones };
}

export async function createVendedor(
  empresaId: number,
  data: { nombre: string; nit?: string | null; telefono?: string | null; email?: string | null; dpi?: string | null; direccion?: string | null },
) {
  const created = await prisma.vendedor.create({
    data: {
      empresaId,
      nombre:    data.nombre,
      nit:       data.nit ?? null,
      telefono:  data.telefono ?? null,
      email:     data.email ?? null,
      dpi:       data.dpi ?? null,
      direccion: data.direccion ?? null,
    },
  });
  return getVendedor(created.id, empresaId);
}

export async function updateVendedor(
  id: number,
  empresaId: number,
  data: Partial<{ nombre: string; nit: string | null; telefono: string | null; email: string | null; dpi: string | null; direccion: string | null; activo: boolean }>,
) {
  const vendedor = await prisma.vendedor.findFirst({ where: { id, empresaId } });
  if (!vendedor) return null;

  const payload: Record<string, unknown> = {};
  for (const key of ['nombre', 'nit', 'telefono', 'email', 'dpi', 'direccion', 'activo'] as const) {
    if (data[key] !== undefined) payload[key] = data[key];
  }
  if (Object.keys(payload).length === 0) return getVendedor(id, empresaId);
  await prisma.vendedor.update({ where: { id }, data: payload });
  return getVendedor(id, empresaId);
}

export async function deleteVendedor(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.vendedor.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}

/* ── Comisiones ───────────────────────────────────────────── */

export async function listComisiones(vendedorId: number, empresaId: number) {
  const rows = await prisma.comision.findMany({
    where:   { vendedorId, empresaId },
    include: { vendedor: { select: { nombre: true } } },
    orderBy: { fechaVenta: 'desc' },
  });
  return rows.map((c) => ({ ...c, vendedor_nombre: c.vendedor.nombre }));
}

export async function createComision(
  empresaId: number,
  vendedorId: number,
  data: { descripcion_lote: string; valor_lote: number; porcentaje: number; fecha_venta: string },
) {
  const monto = Number((data.valor_lote * data.porcentaje / 100).toFixed(2));
  const created = await prisma.comision.create({
    data: {
      empresaId,
      vendedorId,
      descripcionLote: data.descripcion_lote,
      valorLote:       data.valor_lote,
      porcentaje:      data.porcentaje,
      montoComision:   monto,
      fechaVenta:      new Date(data.fecha_venta),
    },
    include: { vendedor: { select: { nombre: true } } },
  });
  return { ...created, vendedor_nombre: created.vendedor.nombre };
}

export async function updateComision(
  id: number,
  empresaId: number,
  data: { descripcion_lote?: string; valor_lote?: number; porcentaje?: number; fecha_venta?: string },
) {
  const current = await prisma.comision.findFirst({ where: { id, empresaId } });
  if (!current) return null;

  const valorLote  = data.valor_lote  ?? Number(current.valorLote);
  const porcentaje = data.porcentaje  ?? Number(current.porcentaje);
  const monto      = Number((valorLote * porcentaje / 100).toFixed(2));

  const updated = await prisma.comision.update({
    where: { id },
    data: {
      descripcionLote: data.descripcion_lote ?? current.descripcionLote,
      valorLote,
      porcentaje,
      montoComision: monto,
      fechaVenta:    data.fecha_venta ? new Date(data.fecha_venta) : current.fechaVenta,
    },
    include: { vendedor: { select: { nombre: true } } },
  });
  return { ...updated, vendedor_nombre: updated.vendedor.nombre };
}

export async function deleteComision(id: number, empresaId: number): Promise<boolean> {
  const result = await prisma.comision.deleteMany({ where: { id, empresaId } });
  return result.count > 0;
}
