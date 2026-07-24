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
import { generarPlanVenta, regenerarPlanVenta } from '../amortizacion/amortizacion.service.js';
import { deleteFileIfLocal } from '../../utils/files.js';
import {
  between,
  intNonNegative,
  nonEmptyString,
  nonNegative,
  optionalString,
  positive,
  ValidationError,
} from '../../utils/validate.js';

function validateVentaTerms(p: {
  precioTotal?: number; enganche?: number; tasaAnual?: number;
  numCuotas?: number; valorCuota?: number; cuotaInicio?: number;
  descripcionLote?: string | null;
}) {
  if (p.precioTotal !== undefined) positive('Precio total', p.precioTotal);
  if (p.enganche !== undefined)    nonNegative('Enganche', p.enganche);
  if (p.tasaAnual !== undefined)   between('Tasa anual', p.tasaAnual, 0, 1);     // 0..100%
  if (p.numCuotas !== undefined)   intNonNegative('Número de cuotas', p.numCuotas);
  if (p.valorCuota !== undefined)  nonNegative('Valor por cuota', p.valorCuota);
  if (p.cuotaInicio !== undefined) intNonNegative('Cuota inicio', p.cuotaInicio);
  if (p.descripcionLote != null)   optionalString('Descripción del lote', p.descripcionLote, 255);
  if (p.enganche !== undefined && p.precioTotal !== undefined && p.enganche > p.precioTotal) {
    throw new ValidationError('El enganche no puede ser mayor al precio total');
  }
}

export interface CreateVentaInput {
  // Opción A: propietario existente
  propietarioId?: number;
  // Opción B: crear propietario nuevo
  propietario?: { nombre: string; nit?: string | null; email?: string | null; telefono?: string | null; direccion?: string | null };

  // Proyecto al que pertenece la venta. Opcional en el input; si no viene,
  // el service lo resuelve al primer proyecto activo de la empresa
  // (mantiene compatibilidad con clients viejos que no lo mandan).
  proyectoId?: number;
  loteId?: number | null;
  descripcionLote?: string | null;
  vendedorId?: number | null;

  precioTotal: number;
  enganche?: number;
  tasaAnual?: number;
  numCuotas?: number;
  valorCuota?: number;
  cuotaInicio?: number;

  fechaInicio: string;       // YYYY-MM-DD
  fechaFin?: string | null;

  numTransferencia?: string | null;
  metodoPago?: string | null;
  entidadBancaria?: EntidadBancaria | null;
  comprobanteEngancheUrl?: string | null;
}

/* ── Helpers ────────────────────────────────────────────────── */

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const includeDetalle = {
  propietario: true,
  proyecto:    { select: { id: true, nombre: true } },
  lote:        true,
  vendedor:    true,
  pagos:       true,
  planCuotas:  true,
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

/**
 * Lista ventas sin lote vinculado dentro de un proyecto. Usado por el editor
 * de croquis para auto-sugerir vinculación cuando el dueño crea un nuevo lote
 * que coincide con una `descripcion_lote` histórica. El frontend hace el
 * matching por substring — más flexible que forzar heurísticas server-side.
 */
export function listVentasSinLote(empresaId: number, proyectoId: number) {
  return prisma.venta.findMany({
    where: {
      empresaId, proyectoId,
      loteId: null,
      estado: { not: 'cancelado' },
    },
    include: includeDetalle,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Vincula una venta huérfana a un lote. Ambos deben pertenecer a la misma
 * empresa Y al mismo proyecto (evita ligar una venta a un lote de otro
 * proyecto por error o IDOR). Devuelve null si algo no cuadra.
 */
export async function vincularVentaALote(
  ventaId: number,
  loteId: number,
  empresaId: number,
) {
  const [venta, lote] = await Promise.all([
    prisma.venta.findFirst({ where: { id: ventaId, empresaId } }),
    prisma.lote.findFirst({ where: { id: loteId, empresaId } }),
  ]);
  if (!venta || !lote) return null;
  if (venta.proyectoId !== lote.proyectoId) {
    throw new Error('El lote y la venta pertenecen a proyectos distintos');
  }
  await prisma.venta.update({ where: { id: ventaId }, data: { loteId } });
  return getVenta(ventaId, empresaId);
}

/* ── Creación ─────────────────────────────────────────────── */

export async function createVenta(empresaId: number, input: CreateVentaInput) {
  // Validaciones antes de la transacción
  validateVentaTerms({
    precioTotal:    input.precioTotal,
    enganche:       input.enganche,
    tasaAnual:      input.tasaAnual,
    numCuotas:      input.numCuotas,
    valorCuota:     input.valorCuota,
    cuotaInicio:    input.cuotaInicio,
    descripcionLote: input.descripcionLote,
  });
  if (!input.propietarioId && input.propietario?.nombre) {
    nonEmptyString('Nombre del propietario', input.propietario.nombre, 100);
  }

  // Resolver proyecto: si viene explícito, validar pertenencia; si no,
  // usar el primer proyecto activo de la empresa (retro-compat con
  // clients viejos que no envían proyecto_id).
  let proyectoId = input.proyectoId;
  if (proyectoId) {
    const p = await prisma.proyecto.findFirst({
      where: { id: proyectoId, empresaId }, select: { id: true },
    });
    if (!p) throw new ValidationError('El proyecto no existe o no pertenece a esta empresa');
  } else {
    const p = await prisma.proyecto.findFirst({
      where:   { empresaId, activo: true },
      orderBy: { id: 'asc' },
      select:  { id: true },
    });
    if (!p) throw new ValidationError('La empresa no tiene proyectos configurados');
    proyectoId = p.id;
  }

  return prisma.$transaction(async (tx) => {
    // 1. Resolver propietario (existente o crear nuevo)
    let propietarioId = input.propietarioId;
    if (!propietarioId) {
      if (!input.propietario?.nombre) {
        throw new ValidationError('Se requiere propietarioId o propietario.nombre');
      }
      const nuevo = await tx.propietario.create({
        data: {
          empresaId,
          nombre:    input.propietario.nombre,
          nit:       input.propietario.nit ?? null,
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
        proyectoId,
        loteId:           input.loteId ?? null,
        descripcionLote:  input.descripcionLote ?? null,
        vendedorId:       input.vendedorId ?? null,
        precioTotal:      input.precioTotal,
        enganche:         input.enganche ?? 0,
        tasaAnual:        input.tasaAnual ?? 0,
        numCuotas:        input.numCuotas ?? 0,
        valorCuota:       input.valorCuota ?? 0,
        cuotaInicio:      input.cuotaInicio ?? 1,
        fechaInicio:      new Date(input.fechaInicio),
        fechaFin:         input.fechaFin ? new Date(input.fechaFin) : null,
        numTransferencia: input.numTransferencia ?? null,
        metodoPago:       input.metodoPago ?? null,
        entidadBancaria:  input.entidadBancaria ?? null,
        comprobanteEngancheUrl: input.comprobanteEngancheUrl ?? null,
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

    // 5. Generar plan de cuotas referencial (si hay plazo definido)
    if (numCuotas > 0) {
      const plazoAños = Math.ceil(numCuotas / 12);
      await generarPlanVenta(tx, venta.id, empresaId, {
        capital:     Number(input.precioTotal),
        enganche:    Number(input.enganche ?? 0),
        tasaAnual:   Number(input.tasaAnual ?? 0),
        plazoAños,
        fechaInicio: baseDate,
      });
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
    // Campos del propietario (se actualizan en la tabla Propietario asociada)
    propietarioNombre: string;
    propietarioNit: string | null;
    propietarioEmail: string | null;
    propietarioTelefono: string | null;
    propietarioDireccion: string | null;
    // Campos de la venta
    loteId: number | null;
    descripcionLote: string | null;
    vendedorId: number | null;
    precioTotal: number;
    enganche: number;
    tasaAnual: number;
    numCuotas: number;
    valorCuota: number;
    cuotaInicio: number;
    fechaInicio: string;
    fechaFin: string | null;
    numTransferencia: string | null;
    metodoPago: string | null;
    entidadBancaria: EntidadBancaria | null;
    comprobanteEngancheUrl: string | null;
    estado: EstadoVenta;
  }>,
) {
  const venta = await prisma.venta.findFirst({ where: { id, empresaId } });
  if (!venta) return null;

  // Validar antes de tocar la BD
  validateVentaTerms({
    precioTotal:    data.precioTotal,
    enganche:       data.enganche,
    tasaAnual:      data.tasaAnual,
    numCuotas:      data.numCuotas,
    valorCuota:     data.valorCuota,
    cuotaInicio:    data.cuotaInicio,
    descripcionLote: data.descripcionLote,
  });
  if (data.propietarioNombre !== undefined) {
    nonEmptyString('Nombre del propietario', data.propietarioNombre, 100);
  }

  // Actualizar datos del propietario si vienen en el payload
  const propData: Record<string, unknown> = {};
  if (data.propietarioNombre   !== undefined) propData.nombre    = data.propietarioNombre;
  if (data.propietarioNit      !== undefined) propData.nit       = data.propietarioNit;
  if (data.propietarioEmail    !== undefined) propData.email     = data.propietarioEmail;
  if (data.propietarioTelefono !== undefined) propData.telefono  = data.propietarioTelefono;
  if (data.propietarioDireccion !== undefined) propData.direccion = data.propietarioDireccion;
  if (Object.keys(propData).length > 0) {
    await prisma.propietario.update({ where: { id: venta.propietarioId }, data: propData });
  }

  await prisma.venta.update({
    where: { id },
    data: {
      ...(data.loteId !== undefined           && { loteId:           data.loteId }),
      ...(data.descripcionLote !== undefined  && { descripcionLote:  data.descripcionLote }),
      ...(data.vendedorId !== undefined       && { vendedorId:       data.vendedorId }),
      ...(data.precioTotal !== undefined      && { precioTotal:      data.precioTotal }),
      ...(data.enganche !== undefined         && { enganche:         data.enganche }),
      ...(data.tasaAnual !== undefined        && { tasaAnual:        data.tasaAnual }),
      ...(data.numCuotas !== undefined        && { numCuotas:        data.numCuotas }),
      ...(data.valorCuota !== undefined       && { valorCuota:       data.valorCuota }),
      ...(data.cuotaInicio !== undefined      && { cuotaInicio:      data.cuotaInicio }),
      ...(data.fechaInicio !== undefined      && { fechaInicio:      new Date(data.fechaInicio) }),
      ...(data.fechaFin !== undefined         && { fechaFin:         data.fechaFin ? new Date(data.fechaFin) : null }),
      ...(data.numTransferencia !== undefined && { numTransferencia: data.numTransferencia }),
      ...(data.metodoPago !== undefined       && { metodoPago:       data.metodoPago }),
      ...(data.entidadBancaria !== undefined  && { entidadBancaria:  data.entidadBancaria }),
      ...(data.comprobanteEngancheUrl !== undefined && { comprobanteEngancheUrl: data.comprobanteEngancheUrl }),
      ...(data.estado !== undefined           && { estado:           data.estado }),
    },
  });

  // Si algún término financiero cambió, regenerar el plan
  const cambioTerminos =
    data.precioTotal !== undefined ||
    data.enganche    !== undefined ||
    data.tasaAnual   !== undefined ||
    data.numCuotas   !== undefined ||
    data.fechaInicio !== undefined;

  if (cambioTerminos) {
    const actual = await prisma.venta.findUniqueOrThrow({ where: { id } });
    if (actual.numCuotas > 0) {
      const plazoAños = Math.ceil(actual.numCuotas / 12);
      await regenerarPlanVenta(id, empresaId, {
        capital:     Number(actual.precioTotal),
        enganche:    Number(actual.enganche),
        tasaAnual:   Number(actual.tasaAnual),
        plazoAños,
        fechaInicio: actual.fechaInicio,
      });
    }
  }

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
  const venta = await prisma.venta.findFirst({
    where: { id, empresaId },
    include: {
      pagos:       { select: { comprobanteUrl: true } },
      expedientes: { select: { archivoUrl: true } },
    },
  });
  if (!venta) return false;

  // Recolectamos URLs de archivos locales para borrarlos del disco después del commit
  const filesToDelete: (string | null)[] = [
    venta.comprobanteEngancheUrl,
    ...venta.pagos.map((p) => p.comprobanteUrl),
    ...venta.expedientes.map((e) => e.archivoUrl),
  ];

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

  // Después del commit, liberamos espacio en disco (no bloquea ni revierte la transacción)
  for (const url of filesToDelete) {
    if (url) await deleteFileIfLocal(url);
  }
  return true;
}
