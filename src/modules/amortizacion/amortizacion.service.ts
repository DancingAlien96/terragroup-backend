/**
 * amortizacion.service.ts — Generación del plan de cuotas referencial.
 *
 * Replica el modelo del Excel de CF Constructora:
 *   1. Cuota anual con PMT(tasaAnual, plazoAños, -montoFinanciado) → compuesto anual.
 *   2. Cuota mensual referencial = cuotaAnual / 12.
 *   3. Por cada año se calcula la proporción interés/cuotaAnual.
 *   4. La tabla mensual aplica la proporción del año correspondiente a cada cuota:
 *        interes  = cuotaMensualRef * propInteresDelAño
 *        capital  = cuotaMensualRef - interes
 *        saldo    = saldo_prev - capital
 *
 * Caso especial tasa = 0 → plan plano: cuota = monto / numCuotas, sin intereses.
 */

import prisma from '../../config/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

export interface CalcInput {
  capital:      number;   // precio total
  enganche:     number;
  tasaAnual:    number;   // 0.10 = 10%
  plazoAños:    number;
  fechaInicio:  Date;
}

export interface CuotaCalculada {
  numCuota:           number;
  anio:               number;
  fechaVencimiento:   Date;
  cuotaReferencial:   number;
  capitalReferencial: number;
  interesReferencial: number;
  saldoReferencial:   number;
  propInteresAnual:   number;
}

/** PMT estándar de Excel: pago periódico para amortizar `pv` a `nper` períodos con tasa `rate`. */
function pmt(rate: number, nper: number, pv: number): number {
  if (rate === 0) return pv / nper;
  return (pv * rate) / (1 - Math.pow(1 + rate, -nper));
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function calcularPlan(input: CalcInput): CuotaCalculada[] {
  const { capital, enganche, tasaAnual, plazoAños, fechaInicio } = input;
  const montoFinanciado = capital - enganche;
  const numMeses = plazoAños * 12;

  if (numMeses <= 0 || montoFinanciado <= 0) return [];

  // ── Caso tasa 0: plan plano sin intereses ──────────────────────
  if (tasaAnual === 0) {
    const cuotaMensual = montoFinanciado / numMeses;
    let saldo = montoFinanciado;
    const cuotas: CuotaCalculada[] = [];
    for (let m = 1; m <= numMeses; m++) {
      saldo -= cuotaMensual;
      cuotas.push({
        numCuota:           m,
        anio:               Math.ceil(m / 12),
        fechaVencimiento:   addMonths(fechaInicio, m),
        cuotaReferencial:   cuotaMensual,
        capitalReferencial: cuotaMensual,
        interesReferencial: 0,
        saldoReferencial:   Math.max(saldo, 0),
        propInteresAnual:   0,
      });
    }
    return cuotas;
  }

  // ── Caso con intereses: modelo Excel ───────────────────────────

  // 1. Cuota anual y mensual referencial
  const cuotaAnual       = pmt(tasaAnual, plazoAños, montoFinanciado);
  const cuotaMensualRef  = cuotaAnual / 12;

  // 2. Tabla anual → propInteres por año (index 1-based)
  const propInteresPorAño: number[] = new Array(plazoAños + 1).fill(0);
  let saldoAnual = montoFinanciado;
  for (let y = 1; y <= plazoAños; y++) {
    const interes       = saldoAnual * tasaAnual;
    const capitalPagado = cuotaAnual - interes;
    propInteresPorAño[y] = interes / cuotaAnual;
    saldoAnual -= capitalPagado;
  }

  // 3. Tabla mensual aplicando la proporción del año
  let saldoMensual = montoFinanciado;
  const cuotas: CuotaCalculada[] = [];
  for (let m = 1; m <= numMeses; m++) {
    const anio        = Math.ceil(m / 12);
    const propInteres = propInteresPorAño[anio];
    const interes     = cuotaMensualRef * propInteres;
    const capital     = cuotaMensualRef - interes;
    saldoMensual -= capital;
    cuotas.push({
      numCuota:           m,
      anio,
      fechaVencimiento:   addMonths(fechaInicio, m),
      cuotaReferencial:   cuotaMensualRef,
      capitalReferencial: capital,
      interesReferencial: interes,
      saldoReferencial:   saldoMensual,
      propInteresAnual:   propInteres,
    });
  }
  return cuotas;
}

/* ──────────────────────────────────────────────────────────────────
 *  Persistencia: generar y guardar el plan de cuotas para una venta.
 *  Acepta una transacción opcional para integrarse con createVenta.
 * ──────────────────────────────────────────────────────────────── */

type Tx = Prisma.TransactionClient;
type Client = typeof prisma | Tx;

export async function generarPlanVenta(
  client: Client,
  ventaId: number,
  empresaId: number,
  params: CalcInput,
): Promise<number> {
  const cuotas = calcularPlan(params);
  if (cuotas.length === 0) return 0;

  await client.planCuota.createMany({
    data: cuotas.map((c) => ({
      empresaId,
      ventaId,
      numCuota:           c.numCuota,
      anio:               c.anio,
      fechaVencimiento:   c.fechaVencimiento,
      cuotaReferencial:   c.cuotaReferencial,
      capitalReferencial: c.capitalReferencial,
      interesReferencial: c.interesReferencial,
      saldoReferencial:   c.saldoReferencial,
      propInteresAnual:   c.propInteresAnual,
    })),
  });
  return cuotas.length;
}

export async function regenerarPlanVenta(
  ventaId: number,
  empresaId: number,
  params: CalcInput,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    await tx.planCuota.deleteMany({ where: { ventaId, empresaId } });
    return generarPlanVenta(tx, ventaId, empresaId, params);
  });
}

/**
 * Liquida anticipadamente todas las cuotas pendientes de una venta.
 * Crea un Pago por cada cuota no-pagada con monto = cuotaReferencial y estado pagado.
 * Devuelve cuántos pagos se crearon y el total liquidado.
 */
export async function liquidarVenta(
  ventaId: number,
  empresaId: number,
  opts: {
    metodoPago?: string | null;
    referencia?: string | null;
    descripcion?: string | null;
    fechaPago?: Date;
    comprobanteUrl?: string | null;
  },
): Promise<{ creados: number; totalLiquidado: number }> {
  return prisma.$transaction(async (tx) => {
    const planCuotas = await tx.planCuota.findMany({
      where:   { ventaId, empresaId },
      orderBy: { numCuota: 'asc' },
    });
    const existingPagos = await tx.pago.findMany({
      where:  { ventaId, empresaId },
      select: { numCuota: true },
    });
    const yaTienePago = new Set(existingPagos.map((p) => p.numCuota).filter((n): n is number => n != null));

    const fechaPago   = opts.fechaPago ?? new Date();
    const descripcion = opts.descripcion ?? 'Liquidación anticipada';

    const data = planCuotas
      .filter((c) => !yaTienePago.has(c.numCuota))
      .map((c) => ({
        empresaId,
        ventaId,
        numCuota:         c.numCuota,
        monto:            c.cuotaReferencial,
        fechaVencimiento: c.fechaVencimiento,
        fechaPago,
        estado:           'pagado' as const,
        metodoPago:       opts.metodoPago ?? null,
        referencia:       opts.referencia ?? null,
        descripcion,
        comprobanteUrl:   opts.comprobanteUrl ?? null,
      }));

    if (data.length === 0) return { creados: 0, totalLiquidado: 0 };

    await tx.pago.createMany({ data });
    const total = data.reduce((s, p) => s + Number(p.monto), 0);
    return { creados: data.length, totalLiquidado: total };
  });
}

/** Devuelve el plan de una venta con los pagos cruzados por numCuota. */
export async function obtenerPlanVenta(ventaId: number, empresaId: number) {
  const venta = await prisma.venta.findFirst({
    where:   { id: ventaId, empresaId },
    include: { pagos: true, propietario: true, lote: true },
  });
  if (!venta) return null;

  const plan = await prisma.planCuota.findMany({
    where:   { ventaId, empresaId },
    orderBy: { numCuota: 'asc' },
  });

  const pagosPorCuota = new Map<number, typeof venta.pagos[number]>();
  for (const p of venta.pagos) {
    if (p.numCuota != null) pagosPorCuota.set(p.numCuota, p);
  }

  // Recorre el plan en orden y aplica los abonos extra a capital:
  //   abonoExtra = max(0, monto pagado - cuota referencial) cuando estado = pagado
  //   saldoAjustado = saldoReferencial - acumulado de abonos extras hasta esa cuota
  //   estaCubierta = saldoAjustado <= 0 (cuota anticipadamente cubierta por abonos previos)
  let acumExtra = 0;
  let cuotasCubiertas = 0;
  const filas = plan.map((c) => {
    const pago = pagosPorCuota.get(c.numCuota) ?? null;
    const cuotaRef = Number(c.cuotaReferencial);
    const fuePagado = pago?.estado === 'pagado';
    const abonoExtra = fuePagado ? Math.max(0, Number(pago!.monto) - cuotaRef) : 0;
    acumExtra += abonoExtra;

    const saldoOriginal = Number(c.saldoReferencial);
    const saldoAjustado = Math.max(0, saldoOriginal - acumExtra);
    // Una cuota futura (sin pago) se considera "cubierta" si el saldo original
    // de la cuota anterior ya estaba completamente absorbido por abonos extras.
    const saldoAnteriorAjustado = saldoOriginal + Number(c.capitalReferencial) - acumExtra;
    const estaCubierta = !fuePagado && saldoAnteriorAjustado <= 0;
    if (estaCubierta) cuotasCubiertas++;

    return {
      ...c,
      abonoExtra,
      saldoAjustado,
      estaCubierta,
      pago: pago
        ? {
            id:          pago.id,
            estado:      pago.estado,
            monto:       pago.monto,
            fechaPago:   pago.fechaPago,
            metodoPago:  pago.metodoPago,
            referencia:  pago.referencia,
            descripcion: pago.descripcion,
          }
        : null,
    };
  });

  return {
    venta,
    plan: filas,
    resumen: {
      totalAbonosExtra: acumExtra,
      cuotasCubiertas,
    },
  };
}
