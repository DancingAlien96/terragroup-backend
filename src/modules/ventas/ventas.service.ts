/**
 * ventas.service.ts — La transacción central del sistema (reemplaza `clientes` + `contratos`).
 *
 * Una venta vincula:
 *   - 1 propietario (obligatorio)
 *   - 1 lote (opcional, NULL = descripcion libre)
 *   - 1 vendedor (opcional)
 *   - términos financieros (precioTotal, enganche, numCuotas, valorCuota, cuotaInicio)
 *   - datos del depósito inicial (numTransferencia, metodoPago, entidadBancaria)
 *
 * Al crear: si se pasan datos de un propietario nuevo, se crea en la misma transacción.
 *           También se autogeneran las cuotas vencidas en `pagos`.
 */

import prisma from '../../config/prisma.js';
import {
  EntidadBancaria,
  EstadoLote,
  EstadoPago,
  EstadoVenta,
} from '../../generated/prisma/enums.js';

export interface CreateVentaInput {
  // Opción A: propietario existente
  propietarioId?: number;
  // Opción B: crear propietario nuevo
  propietario?: { nombre: string; email?: string | null; telefono?: string | null; direccion?: string | null };

  loteId?: number | null;
  descripcionLote?: string | null;
  vendedorId?: number | null;

  precioTotal: number;
  enganche?: number;
  numCuotas?: number;
  valorCuota?: number;
  cuotaInicio?: number;

  fechaInicio: string;       // YYYY-MM-DD
  fechaFin?: string | null;

  numTransferencia?: string | null;
  metodoPago?: string | null;
  entidadBancaria?: EntidadBancaria | null;
}

/* ── Helpers ────────────────────────────────────────────────── */

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const includeDetalle = {
  propietario: true,
  lote:        true,
  vendedor:    true,
  pagos:       true,
} as const;

/* ── Lectura ───────────────────────────────────────────────── */

export function listVentas(empresaId: number) {
  return prisma.venta.findMany({
    where: { empresaId },
    include: includeDetalle,
    orderBy: { createdAt: 'desc' },
  });
}

export function getVenta(id: number, empresaId: number) {
  return prisma.venta.findFirst({
    where: { id, empresaId },
    include: includeDetalle,
  });
}

/* ── Creación ─────────────────────────────────────────────── */

export async function createVenta(empresaId: number, input: CreateVentaInput) {
  return prisma.$transaction(async (tx) => {
    // 1. Resolver propietario (existente o crear nuevo)
    let propietarioId = input.propietarioId;
    if (!propietarioId) {
      if (!input.propietario?.nombre) {
        throw new Error('Se requiere propietarioId o propietario.nombre');
      }
      const nuevo = await tx.propietario.create({
        data: {
          empresaId,
          nombre:    input.propietario.nombre,
          email:     input.propietario.email ?? null,
          telefono:  input.propietario.telefono ?? null,
          direccion: input.propietario.direccion ?? null,
        },
      });
      propietarioId = nuevo.id;
    }

    // 2. Crear venta
    const venta = await tx.venta.create({
      data: {
        empresaId,
        propietarioId,
        loteId:           input.loteId ?? null,
        descripcionLote:  input.descripcionLote ?? null,
        vendedorId:       input.vendedorId ?? null,
        precioTotal:      input.precioTotal,
        enganche:         input.enganche ?? 0,
        numCuotas:        input.numCuotas ?? 0,
        valorCuota:       input.valorCuota ?? 0,
        cuotaInicio:      input.cuotaInicio ?? 1,
        fechaInicio:      new Date(input.fechaInicio),
        fechaFin:         input.fechaFin ? new Date(input.fechaFin) : null,
        numTransferencia: input.numTransferencia ?? null,
        metodoPago:       input.metodoPago ?? null,
        entidadBancaria:  input.entidadBancaria ?? null,
      },
    });

    // 3. Marcar lote como vendido si aplica
    if (input.loteId) {
      await tx.lote.update({
        where: { id: input.loteId },
        data:  { estado: EstadoLote.vendido },
      });
    }

    // 4. Auto-generar pagos para cuotas ya vencidas
    const today = new Date();
    today.setHours(23, 59, 59, 0);
    const baseDate = new Date(input.fechaInicio);
    const cuotaInicio = input.cuotaInicio ?? 1;
    const numCuotas   = input.numCuotas ?? 0;
    const valorCuota  = input.valorCuota ?? 0;

    const pagosACrear: Array<{
      empresaId: number; ventaId: number; numCuota: number;
      monto: number; fechaVencimiento: Date; estado: EstadoPago;
    }> = [];
    for (let i = cuotaInicio; i <= numCuotas; i++) {
      const due = addMonths(baseDate, i);
      if (due > today) break;
      pagosACrear.push({
        empresaId,
        ventaId:          venta.id,
        numCuota:         i,
        monto:            valorCuota,
        fechaVencimiento: due,
        estado:           EstadoPago.pendiente,
      });
    }
    if (pagosACrear.length > 0) {
      await tx.pago.createMany({ data: pagosACrear });
    }

    return tx.venta.findUniqueOrThrow({
      where: { id: venta.id },
      include: includeDetalle,
    });
  });
}

/* ── Actualización ─────────────────────────────────────────── */

export async function updateVenta(
  id: number,
  empresaId: number,
  data: Partial<{
    loteId: number | null;
    descripcionLote: string | null;
    vendedorId: number | null;
    precioTotal: number;
    enganche: number;
    numCuotas: number;
    valorCuota: number;
    cuotaInicio: number;
    fechaInicio: string;
    fechaFin: string | null;
    numTransferencia: string | null;
    metodoPago: string | null;
    entidadBancaria: EntidadBancaria | null;
    estado: EstadoVenta;
  }>,
) {
  const venta = await prisma.venta.findFirst({ where: { id, empresaId } });
  if (!venta) return null;

  await prisma.venta.update({
    where: { id },
    data: {
      ...(data.loteId !== undefined           && { loteId:           data.loteId }),
      ...(data.descripcionLote !== undefined  && { descripcionLote:  data.descripcionLote }),
      ...(data.vendedorId !== undefined       && { vendedorId:       data.vendedorId }),
      ...(data.precioTotal !== undefined      && { precioTotal:      data.precioTotal }),
      ...(data.enganche !== undefined         && { enganche:         data.enganche }),
      ...(data.numCuotas !== undefined        && { numCuotas:        data.numCuotas }),
      ...(data.valorCuota !== undefined       && { valorCuota:       data.valorCuota }),
      ...(data.cuotaInicio !== undefined      && { cuotaInicio:      data.cuotaInicio }),
      ...(data.fechaInicio !== undefined      && { fechaInicio:      new Date(data.fechaInicio) }),
      ...(data.fechaFin !== undefined         && { fechaFin:         data.fechaFin ? new Date(data.fechaFin) : null }),
      ...(data.numTransferencia !== undefined && { numTransferencia: data.numTransferencia }),
      ...(data.metodoPago !== undefined       && { metodoPago:       data.metodoPago }),
      ...(data.entidadBancaria !== undefined  && { entidadBancaria:  data.entidadBancaria }),
      ...(data.estado !== undefined           && { estado:           data.estado }),
    },
  });

  // Liberar lote si la venta se cancela
  if (data.estado === EstadoVenta.cancelado && venta.loteId) {
    await prisma.lote.update({
      where: { id: venta.loteId },
      data:  { estado: EstadoLote.disponible },
    });
  }

  return getVenta(id, empresaId);
}

/* ── Eliminación ──────────────────────────────────────────── */

export async function deleteVenta(id: number, empresaId: number): Promise<boolean> {
  const venta = await prisma.venta.findFirst({ where: { id, empresaId } });
  if (!venta) return false;

  await prisma.$transaction(async (tx) => {
    // Cascada en pagos/expedientes está configurada en el schema; basta con borrar la venta
    await tx.venta.delete({ where: { id } });

    // Si tenía lote asociado, regresarlo a disponible
    if (venta.loteId) {
      await tx.lote.update({
        where: { id: venta.loteId },
        data:  { estado: EstadoLote.disponible },
      });
    }
  });
  return true;
}
