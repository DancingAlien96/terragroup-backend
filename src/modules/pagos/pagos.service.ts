import prisma from '../../config/prisma.js';
import { EstadoCuenta, EstadoPago } from '../../generated/prisma/enums.js';
import { optionalString, positive, ValidationError } from '../../utils/validate.js';
import { deleteFileIfLocal } from '../../utils/files.js';

const includeDetalle = {
  venta: {
    include: {
      propietario: { select: { nombre: true, email: true } },
      lote:        { select: { clave: true } },
    },
  },
} as const;

function shape(p: any) {
  return {
    id:                p.id,
    empresa_id:        p.empresaId,
    venta_id:          p.ventaId,
    cliente_id:        p.ventaId,        // alias legacy (UI espera cliente_id)
    num_cuota:         p.numCuota,
    num_recibo:        p.numRecibo,
    monto:             Number(p.monto),
    fecha_pago:        p.fechaPago,
    fecha_vencimiento: p.fechaVencimiento,
    estado:            p.estado,
    metodo_pago:       p.metodoPago,
    referencia:        p.referencia,
    descripcion:       p.descripcion,
    comprobante_url:   p.comprobanteUrl,
    created_at:        p.createdAt,
    updated_at:        p.updatedAt,
    // Campos enriquecidos (desde venta/propietario/lote)
    propietario_nombre:        p.venta?.propietario?.nombre ?? '—',
    propietario_email:         p.venta?.propietario?.email ?? null,
    lote_clave:                p.venta?.lote?.clave ?? '—',
    cliente_nombre_comprador:  p.venta?.propietario?.nombre ?? null,
    cliente_descripcion_lote:  p.venta?.descripcionLote ?? null,
    cliente_num_cuotas:        p.venta?.numCuotas ?? null,
  };
}

export async function listPagos(empresaId: number) {
  const rows = await prisma.pago.findMany({
    where:   { empresaId },
    include: includeDetalle,
    orderBy: { fechaVencimiento: 'desc' },
  });
  return rows.map(shape);
}

export async function getPago(id: number, empresaId: number) {
  const row = await prisma.pago.findFirst({
    where:   { id, empresaId },
    include: includeDetalle,
  });
  return row ? shape(row) : null;
}

export async function createPago(
  empresaId: number,
  data: {
    venta_id?: number; ventaId?: number;
    cliente_id?: number;                  // alias legacy
    monto: number;
    fecha_vencimiento: string;
    fecha_pago?: string;
    estado?: EstadoPago;
    metodo_pago?: string;
    referencia?: string;
    descripcion?: string | null;
    comprobante_url?: string | null;
  },
) {
  const ventaId = data.ventaId ?? data.venta_id ?? data.cliente_id;
  if (!ventaId) throw new ValidationError('venta_id es requerido');
  positive('Monto del pago', data.monto);
  if (data.referencia != null)  optionalString('Referencia', data.referencia, 100);

  // Auto-cuota: siguiente número de cuota después de los pagos existentes, offset por cuotaInicio
  const [pagosCount, venta] = await Promise.all([
    prisma.pago.count({ where: { ventaId, empresaId } }),
    prisma.venta.findUnique({ where: { id: ventaId }, select: { cuotaInicio: true } }),
  ]);
  const numCuota = pagosCount + (venta?.cuotaInicio ?? 1);

  // Numerador de recibo correlativo por empresa (próximo = max + 1)
  const aggRecibo = await prisma.pago.aggregate({
    where: { empresaId },
    _max:  { numRecibo: true },
  });
  const numRecibo = (aggRecibo._max.numRecibo ?? 0) + 1;

  const created = await prisma.pago.create({
    data: {
      empresaId,
      ventaId,
      numCuota,
      numRecibo,
      monto:            data.monto,
      fechaVencimiento: new Date(data.fecha_vencimiento),
      fechaPago:        data.fecha_pago ? new Date(data.fecha_pago) : null,
      estado:           data.estado ?? EstadoPago.pagado,
      metodoPago:       data.metodo_pago ?? null,
      referencia:       data.referencia ?? null,
      descripcion:      data.descripcion ?? null,
      comprobanteUrl:   data.comprobante_url ?? null,
    },
  });
  return (await getPago(created.id, empresaId))!;
}

export async function updatePago(
  id: number,
  empresaId: number,
  data: Partial<{
    monto: number; fecha_vencimiento: string; fecha_pago: string;
    estado: EstadoPago; metodo_pago: string; referencia: string;
    descripcion: string | null; comprobante_url: string | null;
  }>,
) {
  const existing = await prisma.pago.findFirst({ where: { id, empresaId } });
  if (!existing) return null;

  if (data.monto !== undefined)       positive('Monto del pago', data.monto);
  if (data.referencia !== undefined)  optionalString('Referencia', data.referencia, 100);
  if (data.descripcion !== undefined) optionalString('Descripción', data.descripcion, 500);

  const payload: Record<string, unknown> = {};
  if (data.monto !== undefined)             payload.monto            = data.monto;
  if (data.fecha_vencimiento !== undefined) payload.fechaVencimiento = new Date(data.fecha_vencimiento);
  if (data.fecha_pago !== undefined)        payload.fechaPago        = new Date(data.fecha_pago);
  if (data.estado !== undefined)            payload.estado           = data.estado;
  if (data.metodo_pago !== undefined)       payload.metodoPago       = data.metodo_pago;
  if (data.referencia !== undefined)        payload.referencia       = data.referencia;
  if (data.descripcion !== undefined)       payload.descripcion      = data.descripcion;
  if (data.comprobante_url !== undefined)   payload.comprobanteUrl   = data.comprobante_url;

  if (Object.keys(payload).length > 0) {
    await prisma.pago.update({ where: { id }, data: payload });
  }

  // Actualizar estado_cuenta del propietario asociado, basado en los pagos de TODAS sus ventas
  const venta = await prisma.venta.findUnique({
    where:  { id: existing.ventaId },
    select: { propietarioId: true },
  });
  if (venta) {
    const stats = await prisma.pago.groupBy({
      by: ['estado'],
      where: {
        empresaId,
        venta: { propietarioId: venta.propietarioId },
      },
      _count: true,
    });
    const counts = { pagado: 0, pendiente: 0, vencido: 0 };
    for (const s of stats) counts[s.estado] = s._count;
    const total = counts.pagado + counts.pendiente + counts.vencido;
    let estadoCuenta: EstadoCuenta = EstadoCuenta.al_dia;
    if (counts.vencido > 2) estadoCuenta = EstadoCuenta.vencido;
    else if (counts.vencido > 0) estadoCuenta = EstadoCuenta.moroso;
    else if (counts.pagado === total && total > 0) estadoCuenta = EstadoCuenta.liquidado;
    await prisma.propietario.update({
      where: { id: venta.propietarioId },
      data:  { estadoCuenta },
    });
  }

  return getPago(id, empresaId);
}

export async function deletePago(id: number, empresaId: number): Promise<boolean> {
  const existing = await prisma.pago.findFirst({
    where:  { id, empresaId },
    select: { comprobanteUrl: true },
  });
  if (!existing) return false;
  const result = await prisma.pago.deleteMany({ where: { id, empresaId } });
  if (result.count > 0 && existing.comprobanteUrl) {
    // Libera el espacio en disco (solo si el URL es local)
    await deleteFileIfLocal(existing.comprobanteUrl);
  }
  return result.count > 0;
}
