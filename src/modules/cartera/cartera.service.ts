/**
 * cartera.service.ts — Cálculo de mora basado en `ventas` + `pagos`.
 *
 * Reglas (idénticas al frontend `dashboard/cartera/page.tsx`):
 *   - Cuota i vence i meses después de `fechaInicio` (i = cuotaInicio..numCuotas).
 *   - Cada pago registrado cubre una cuota (FIFO, sin importar la fecha del pago).
 *   - Si hay N cuotas vencidas hasta hoy y menos de N pagos, las restantes son mora.
 */

import prisma from '../../config/prisma.js';

export interface CarteraItem {
  id: number;
  nombre_comprador: string;
  descripcion_lote: string;
  valor_cuota: number;
  num_cuotas: number;
  fecha_deposito: string;
  cuotas_vencidas: number;
  monto_vencido: number;
  dias_mora: number;
  estado_mora: 'temprana' | 'media' | 'grave';
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

export async function getCarteraVencida(empresaId: number): Promise<CarteraItem[]> {
  const ventas = await prisma.venta.findMany({
    where:   { empresaId, estado: { not: 'cancelado' } },
    include: {
      propietario: { select: { nombre: true } },
      lote:        { select: { clave: true } },
      pagos:       { select: { numCuota: true } },
    },
  });

  const today = new Date();
  today.setHours(23, 59, 59, 0);

  const items: CarteraItem[] = [];
  for (const v of ventas) {
    const numCuotas   = v.numCuotas;
    const valorCuota  = Number(v.valorCuota);
    const cuotaInicio = v.cuotaInicio ?? 1;
    if (numCuotas <= 0 || valorCuota <= 0) continue;

    const fechaInicio = new Date(v.fechaInicio);

    // Fechas de vencimiento ya cumplidas
    const vencidasFechas: Date[] = [];
    for (let i = 1; i <= numCuotas; i++) {
      const due = addMonths(fechaInicio, i);
      if (due <= today) vencidasFechas.push(due);
      else break;
    }
    const pagosCliente = v.pagos.length;
    const cuotasPrevias = Math.max(0, cuotaInicio - 1);
    const cuotasVencidas = vencidasFechas.length - pagosCliente - cuotasPrevias;
    if (cuotasVencidas <= 0) continue;

    const cuotaMasAntigua = vencidasFechas[pagosCliente + cuotasPrevias];
    const diasMora = cuotaMasAntigua
      ? Math.floor((today.getTime() - cuotaMasAntigua.getTime()) / 86_400_000)
      : 0;

    let estadoMora: CarteraItem['estado_mora'] = 'temprana';
    if (diasMora > 90)      estadoMora = 'grave';
    else if (diasMora > 30) estadoMora = 'media';

    items.push({
      id:               v.id,
      nombre_comprador: v.propietario.nombre,
      descripcion_lote: v.descripcionLote ?? v.lote?.clave ?? '—',
      valor_cuota:      valorCuota,
      num_cuotas:       numCuotas,
      fecha_deposito:   fechaInicio.toISOString().slice(0, 10),
      cuotas_vencidas:  cuotasVencidas,
      monto_vencido:    cuotasVencidas * valorCuota,
      dias_mora:        diasMora,
      estado_mora:      estadoMora,
    });
  }

  items.sort((a, b) => b.dias_mora - a.dias_mora);
  return items;
}
