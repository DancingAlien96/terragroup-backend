/**
 * Estadísticas para el dashboard y la página de reportes.
 * Toda la lógica vive aquí (no hay service/controller separados — son solo dos endpoints de lectura).
 */

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import prisma from '../../config/prisma.js';
import { EstadoPago } from '../../generated/prisma/enums.js';

const router = Router();
router.use(authMiddleware);

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

interface VentaStats {
  id: number;
  numCuotas: number;
  valorCuota: number;
  cuotaInicio: number;
  fechaInicio: Date;
  pagosHechos: number;
  cuotasVencidas: number;
}

function statsPorVenta(ventas: Array<{ id: number; numCuotas: number; valorCuota: any; cuotaInicio: number; fechaInicio: Date; pagos: Array<{ estado: string }> }>, today: Date): VentaStats[] {
  return ventas.map((v) => {
    let cuotasVencidas = 0;
    for (let i = 1; i <= v.numCuotas; i++) {
      const due = addMonths(v.fechaInicio, i);
      if (due <= today) cuotasVencidas++;
      else break;
    }
    return {
      id:             v.id,
      numCuotas:      v.numCuotas,
      valorCuota:     Number(v.valorCuota),
      cuotaInicio:    v.cuotaInicio,
      fechaInicio:    v.fechaInicio,
      pagosHechos:    v.pagos.filter((p) => p.estado === 'pagado').length,
      cuotasVencidas,
    };
  });
}

/* ── GET /api/stats/dashboard ──────────────────────────────── */

router.get('/dashboard', async (req, res) => {
  const empresaId = req.user!.empresaId;

  try {
    const today = new Date();
    today.setHours(23, 59, 59, 0);

    const [ventas, totalCobradoAgg] = await Promise.all([
      prisma.venta.findMany({
        where:  { empresaId },
        select: {
          id: true, numCuotas: true, valorCuota: true, cuotaInicio: true, fechaInicio: true,
          propietario: { select: { nombre: true } },
          descripcionLote: true,
          lote: { select: { clave: true } },
          pagos: { select: { estado: true } },
        },
      }),
      prisma.pago.aggregate({
        where:  { empresaId, estado: EstadoPago.pagado },
        _sum:   { monto: true },
      }),
    ]);

    const stats = statsPorVenta(ventas, today);

    // Mora & pendiente
    let totalVencido = 0, totalPendiente = 0, clientesEnMora = 0;
    let donutAlCorriente = 0, donutEnMora = 0, donutLiquidados = 0;

    for (const s of stats) {
      const mora = s.cuotasVencidas - s.pagosHechos;
      if (mora > 0) {
        totalVencido += mora * s.valorCuota;
        clientesEnMora++;
      }
      const cuotasCubiertas = Math.max(s.cuotasVencidas, s.pagosHechos);
      const restantes = s.numCuotas - cuotasCubiertas;
      if (restantes > 0) totalPendiente += restantes * s.valorCuota;

      if (s.pagosHechos >= s.numCuotas) donutLiquidados++;
      else if (s.pagosHechos < s.cuotasVencidas) donutEnMora++;
      else donutAlCorriente++;
    }

    const totalCobrado = Number(totalCobradoAgg._sum.monto ?? 0);
    const totalBase    = totalCobrado + totalVencido + totalPendiente;
    const tasa         = totalBase > 0 ? ((totalCobrado / totalBase) * 100).toFixed(1) : '0.0';

    // Bar chart: pagos últimos 6 meses
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
    const pagosUltimos = await prisma.pago.findMany({
      where: {
        empresaId,
        estado:    EstadoPago.pagado,
        fechaPago: { gte: seisMesesAtras },
      },
      select: { fechaPago: true, monto: true },
    });
    const byMes = new Map<string, number>();
    for (const p of pagosUltimos) {
      if (!p.fechaPago) continue;
      const key = p.fechaPago.toISOString().slice(0, 7); // YYYY-MM
      byMes.set(key, (byMes.get(key) ?? 0) + Number(p.monto));
    }
    const bar = [...byMes.entries()]
      .sort()
      .map(([mesKey, cobrado]) => {
        const d = new Date(mesKey + '-01');
        const mes = d.toLocaleDateString('es-GT', { month: 'short', year: 'numeric' });
        return { mes, mes_key: mesKey, cobrado, pendiente: 0 };
      })
      .slice(-6);

    const donut = [
      { estado: 'Al corriente', total: donutAlCorriente },
      { estado: 'En mora',      total: donutEnMora },
      { estado: 'Liquidado',    total: donutLiquidados },
    ].filter((d) => d.total > 0);

    // Actividad reciente: últimos 5 pagos
    const activityRows = await prisma.pago.findMany({
      where:  { empresaId },
      take:   5,
      orderBy: { createdAt: 'desc' },
      include: {
        venta: {
          select: {
            propietario:     { select: { nombre: true } },
            descripcionLote: true,
            lote:            { select: { clave: true } },
          },
        },
      },
    });
    const activity = activityRows.map((p) => ({
      id:          p.id,
      monto:       Number(p.monto),
      estado:      p.estado,
      fecha_pago:  p.fechaPago,
      propietario: p.venta?.propietario?.nombre ?? '—',
      lote:        p.venta?.descripcionLote ?? p.venta?.lote?.clave ?? '—',
    }));

    // Top deudores
    const deudores = ventas
      .map((v) => {
        const s = stats.find((x) => x.id === v.id)!;
        const mora = s.cuotasVencidas - s.pagosHechos;
        return {
          nombre: v.propietario.nombre,
          lote:   v.descripcionLote ?? v.lote?.clave ?? '—',
          saldo:  mora > 0 ? mora * s.valorCuota : 0,
        };
      })
      .filter((d) => d.saldo > 0)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5);

    return res.json({
      success: true,
      data: {
        kpi: {
          total_cobrado:    totalCobrado,
          total_pendiente:  totalPendiente,
          total_vencido:    totalVencido,
          tasa_cobranza:    tasa,
          clientes_en_mora: clientesEnMora,
        },
        bar,
        donut,
        activity,
        deudores,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

/* ── GET /api/stats/reportes ──────────────────────────────── */

router.get('/reportes', async (req, res) => {
  const empresaId = req.user!.empresaId;

  try {
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

    const pagos = await prisma.pago.findMany({
      where: { empresaId, fechaPago: { gte: seisMesesAtras } },
      select: { fechaPago: true, monto: true, estado: true },
    });
    type Bucket = { cobrado: number; pendiente: number; vencido: number };
    const byMes = new Map<string, Bucket>();
    for (const p of pagos) {
      if (!p.fechaPago) continue;
      const key = p.fechaPago.toISOString().slice(0, 7);
      const b = byMes.get(key) ?? { cobrado: 0, pendiente: 0, vencido: 0 };
      const m = Number(p.monto);
      if (p.estado === 'pagado') b.cobrado += m;
      else if (p.estado === 'pendiente') b.pendiente += m;
      else if (p.estado === 'vencido') b.vencido += m;
      byMes.set(key, b);
    }
    const monthly = [...byMes.entries()].sort().map(([mesKey, b]) => {
      const d = new Date(mesKey + '-01');
      return { mes: d.toLocaleDateString('es-GT', { month: 'short', year: 'numeric' }), mes_key: mesKey, ...b };
    });

    // Saldos por propietario (top 20)
    const ventas = await prisma.venta.findMany({
      where: { empresaId },
      include: {
        propietario: { select: { nombre: true } },
        lote:        { select: { clave: true } },
        pagos:       { select: { estado: true, monto: true } },
      },
    });
    const propietarios = ventas
      .map((v) => {
        let pagado = 0, saldo = 0;
        for (const p of v.pagos) {
          const m = Number(p.monto);
          if (p.estado === 'pagado') pagado += m;
          else saldo += m;
        }
        return {
          nombre: v.propietario.nombre,
          lote:   v.descripcionLote ?? v.lote?.clave ?? '—',
          pagado,
          saldo,
        };
      })
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 20);

    return res.json({ success: true, data: { monthly, propietarios } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al obtener reportes' });
  }
});

/* ── GET /api/stats/resumen-ejecutivo ──────────────────────────
   Reporte consolidado: KPIs + cartera + lotes + top deudores + top vendedores + tendencia.
   Una sola llamada para alimentar el "Reporte General" del frontend. */

router.get('/resumen-ejecutivo', async (req, res) => {
  const empresaId = req.user!.empresaId;

  try {
    const today = new Date();
    today.setHours(23, 59, 59, 0);
    const seisMesesAtras = new Date();
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

    const [
      empresa,
      ventas,
      pagosAgg,
      pagosUltimos,
      lotesByEstado,
      vendedores,
    ] = await Promise.all([
      prisma.empresa.findUnique({
        where:   { id: empresaId },
        include: { plan: true },
      }),
      prisma.venta.findMany({
        where: { empresaId, estado: { not: 'cancelado' } },
        include: {
          propietario: { select: { nombre: true } },
          lote:        { select: { clave: true } },
          pagos:       { select: { estado: true, monto: true } },
        },
      }),
      prisma.pago.groupBy({
        by: ['estado'],
        where:  { empresaId },
        _sum:   { monto: true },
        _count: true,
      }),
      prisma.pago.findMany({
        where:  { empresaId, estado: EstadoPago.pagado, fechaPago: { gte: seisMesesAtras } },
        select: { fechaPago: true, monto: true },
      }),
      prisma.lote.groupBy({
        by: ['estado'],
        where:  { empresaId },
        _count: true,
      }),
      prisma.vendedor.findMany({
        where:   { empresaId, activo: true },
        include: { comisiones: { select: { montoComision: true } } },
      }),
    ]);

    // ── KPIs financieros ──
    const sumByEstado = { pagado: 0, pendiente: 0, vencido: 0 };
    const countByEstado = { pagado: 0, pendiente: 0, vencido: 0 };
    for (const p of pagosAgg) {
      sumByEstado[p.estado]   = Number(p._sum.monto ?? 0);
      countByEstado[p.estado] = p._count;
    }
    const totalCobrado   = sumByEstado.pagado;
    const totalPendiente = sumByEstado.pendiente;
    const totalVencido   = sumByEstado.vencido;
    const totalBase      = totalCobrado + totalPendiente + totalVencido;
    const tasaCobranza   = totalBase > 0 ? Number(((totalCobrado / totalBase) * 100).toFixed(1)) : 0;

    // ── Cartera (mora calculada por venta) ──
    function addMonths(d: Date, m: number): Date {
      const r = new Date(d); r.setMonth(r.getMonth() + m); return r;
    }

    interface MoraVenta {
      ventaId: number;
      nombre: string;
      lote: string;
      cuotasVencidas: number;
      montoVencido: number;
      diasMora: number;
    }
    const enMora: MoraVenta[] = [];

    for (const v of ventas) {
      if (v.numCuotas <= 0 || Number(v.valorCuota) <= 0) continue;
      const fechaInicio = new Date(v.fechaInicio);
      const cuotaInicio = v.cuotaInicio ?? 1;
      const cuotasPrevias = Math.max(0, cuotaInicio - 1);

      const fechasVencidas: Date[] = [];
      for (let i = 1; i <= v.numCuotas; i++) {
        const due = addMonths(fechaInicio, i);
        if (due <= today) fechasVencidas.push(due); else break;
      }
      const pagosHechos = v.pagos.length;
      const cuotasVencidas = fechasVencidas.length - pagosHechos - cuotasPrevias;
      if (cuotasVencidas <= 0) continue;

      const cuotaMasAntigua = fechasVencidas[pagosHechos + cuotasPrevias];
      const diasMora = cuotaMasAntigua
        ? Math.floor((today.getTime() - cuotaMasAntigua.getTime()) / 86_400_000)
        : 0;

      enMora.push({
        ventaId:        v.id,
        nombre:         v.propietario.nombre,
        lote:           v.descripcionLote ?? v.lote?.clave ?? '—',
        cuotasVencidas,
        montoVencido:   cuotasVencidas * Number(v.valorCuota),
        diasMora,
      });
    }

    const moraGrave    = enMora.filter((m) => m.diasMora > 90).length;
    const moraMedia    = enMora.filter((m) => m.diasMora > 30 && m.diasMora <= 90).length;
    const moraTemprana = enMora.filter((m) => m.diasMora <= 30).length;

    const topDeudores = [...enMora]
      .sort((a, b) => b.montoVencido - a.montoVencido)
      .slice(0, 5)
      .map((m) => ({
        nombre:           m.nombre,
        lote:             m.lote,
        cuotas_vencidas:  m.cuotasVencidas,
        monto_vencido:    m.montoVencido,
        dias_mora:        m.diasMora,
      }));

    // ── Lotes por estado ──
    const lotes = { disponible: 0, vendido: 0, reservado: 0 };
    for (const l of lotesByEstado) lotes[l.estado] = l._count;
    const lotesTotal = lotes.disponible + lotes.vendido + lotes.reservado;

    // ── Top vendedores por comisiones ──
    const topVendedores = vendedores
      .map((v) => ({
        nombre:           v.nombre,
        ventas:           v.comisiones.length,
        total_comisiones: v.comisiones.reduce((s, c) => s + Number(c.montoComision), 0),
      }))
      .filter((v) => v.total_comisiones > 0 || v.ventas > 0)
      .sort((a, b) => b.total_comisiones - a.total_comisiones)
      .slice(0, 5);

    // ── Tendencia mensual (últimos 6 meses) ──
    const byMes = new Map<string, number>();
    for (const p of pagosUltimos) {
      if (!p.fechaPago) continue;
      const key = p.fechaPago.toISOString().slice(0, 7);
      byMes.set(key, (byMes.get(key) ?? 0) + Number(p.monto));
    }
    const tendencia = [...byMes.entries()]
      .sort()
      .map(([mesKey, cobrado]) => {
        const d = new Date(mesKey + '-01');
        return {
          mes:      d.toLocaleDateString('es-GT', { month: 'short', year: 'numeric' }),
          mes_key:  mesKey,
          cobrado,
        };
      })
      .slice(-6);

    return res.json({
      success: true,
      data: {
        empresa: {
          nombre:       empresa?.nombre ?? '',
          plan:         empresa?.plan?.nombre ?? '',
          fecha_vence:  empresa?.fechaVence ?? null,
        },
        kpi: {
          total_cobrado:   totalCobrado,
          total_pendiente: totalPendiente,
          total_vencido:   totalVencido,
          tasa_cobranza:   tasaCobranza,
          pagos_pagados:   countByEstado.pagado,
          pagos_pendientes: countByEstado.pendiente,
          pagos_vencidos:  countByEstado.vencido,
        },
        cartera: {
          clientes_totales: ventas.length,
          clientes_en_mora: enMora.length,
          mora_grave:       moraGrave,
          mora_media:       moraMedia,
          mora_temprana:    moraTemprana,
          total_vencido:    enMora.reduce((s, m) => s + m.montoVencido, 0),
        },
        lotes: {
          total:      lotesTotal,
          disponible: lotes.disponible,
          vendido:    lotes.vendido,
          reservado:  lotes.reservado,
        },
        top_deudores:    topDeudores,
        top_vendedores:  topVendedores,
        tendencia,
        generado_en:     new Date(),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al obtener resumen ejecutivo' });
  }
});

export default router;
