import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import pool from '../../config/database.js';

const router = Router();
router.use(authMiddleware);

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
  const empresaId = req.user!.empresaId;

  try {
    // KPI: total cobrado desde pagos reales (cliente_id based)
    const [[kpi]] = await pool.query(`
      SELECT
        COALESCE(SUM(monto), 0) AS total_cobrado,
        COUNT(*)                AS total_pagos
      FROM pagos
      WHERE empresa_id = ? AND cliente_id IS NOT NULL AND estado = 'pagado'
    `, [empresaId]) as any;

    // Cartera vencida: calcular cuotas vencidas sin pago
    // Para cada cliente: cuantas cuotas debieron pagarse hasta hoy vs cuantos pagos hay
    const [clientesRows] = await pool.query(`
      SELECT c.id, c.num_cuotas, c.valor_cuota, c.fecha_deposito,
             COUNT(p.id) AS pagos_hechos
      FROM clientes c
      LEFT JOIN pagos p ON p.cliente_id = c.id AND p.empresa_id = c.empresa_id AND p.estado = 'pagado'
      WHERE c.empresa_id = ?
      GROUP BY c.id
    `, [empresaId]) as any;

    let totalVencido = 0;
    let clientesEnMora = 0;
    const today = new Date();
    today.setHours(23, 59, 59, 0);

    for (const c of clientesRows) {
      const deposito = new Date(c.fecha_deposito);
      let cuotasVencidas = 0;
      for (let i = 1; i <= c.num_cuotas; i++) {
        const due = new Date(deposito);
        due.setMonth(due.getMonth() + i);
        if (due <= today) cuotasVencidas++;
        else break;
      }
      const mora = cuotasVencidas - Number(c.pagos_hechos);
      if (mora > 0) {
        totalVencido += mora * Number(c.valor_cuota);
        clientesEnMora++;
      }
    }

    // Pendiente: cuotas futuras restantes de todos los clientes
    let totalPendiente = 0;
    for (const c of clientesRows) {
      const deposito = new Date(c.fecha_deposito);
      let cuotasVencidas = 0;
      for (let i = 1; i <= c.num_cuotas; i++) {
        const due = new Date(deposito);
        due.setMonth(due.getMonth() + i);
        if (due <= today) cuotasVencidas++;
        else break;
      }
      const pagosHechos = Number(c.pagos_hechos);
      // Cuotas futuras = total - max(vencidas, pagosHechos)
      const cuotasCubiertas = Math.max(cuotasVencidas, pagosHechos);
      const restantes = c.num_cuotas - cuotasCubiertas;
      if (restantes > 0) totalPendiente += restantes * Number(c.valor_cuota);
    }

    const totalCobrado = Number(kpi.total_cobrado);
    const totalBase = totalCobrado + totalVencido + totalPendiente;
    const tasa = totalBase > 0 ? ((totalCobrado / totalBase) * 100).toFixed(1) : '0.0';

    // Bar chart: pagos reales de clientes ultimos 6 meses
    const [barRows] = await pool.query(`
      SELECT
        DATE_FORMAT(fecha_pago, '%b %Y') AS mes,
        DATE_FORMAT(fecha_pago, '%Y-%m') AS mes_key,
        COALESCE(SUM(monto), 0)          AS cobrado,
        0                                AS pendiente
      FROM pagos
      WHERE empresa_id = ? AND cliente_id IS NOT NULL AND estado = 'pagado'
        AND fecha_pago >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY mes_key, mes
      ORDER BY mes_key ASC
      LIMIT 6
    `, [empresaId]) as any;

    // Donut: clientes al corriente vs en mora vs liquidados
    const [clienteStats] = await pool.query(`
      SELECT c.id, c.num_cuotas, c.valor_cuota, c.fecha_deposito,
             COUNT(p.id) AS pagos_hechos
      FROM clientes c
      LEFT JOIN pagos p ON p.cliente_id = c.id AND p.empresa_id = c.empresa_id AND p.estado = 'pagado'
      WHERE c.empresa_id = ?
      GROUP BY c.id
    `, [empresaId]) as any;

    let donutAlCorreinte = 0, donutEnMora = 0, donutLiquidados = 0;
    for (const c of clienteStats) {
      const deposito = new Date(c.fecha_deposito);
      let cuotasVencidas = 0;
      for (let i = 1; i <= c.num_cuotas; i++) {
        const due = new Date(deposito);
        due.setMonth(due.getMonth() + i);
        if (due <= today) cuotasVencidas++;
        else break;
      }
      const pagosHechos = Number(c.pagos_hechos);
      if (pagosHechos >= c.num_cuotas) donutLiquidados++;
      else if (pagosHechos < cuotasVencidas) donutEnMora++;
      else donutAlCorreinte++;
    }

    const donutRows = [
      { estado: 'Al corriente', total: donutAlCorreinte },
      { estado: 'En mora',      total: donutEnMora },
      { estado: 'Liquidado',    total: donutLiquidados },
    ].filter(d => d.total > 0);

    // Actividad reciente: ultimos 5 pagos de clientes
    const [activity] = await pool.query(`
      SELECT p.id, p.monto, p.estado, p.fecha_pago,
             cl.nombre_comprador AS propietario,
             cl.descripcion_lote AS lote
      FROM pagos p
      JOIN clientes cl ON cl.id = p.cliente_id
      WHERE p.empresa_id = ? AND p.cliente_id IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 5
    `, [empresaId]) as any;

    // Top deudores: clientes con mas cuotas vencidas
    const topDeudores = clientesRows
      .map((c: any) => {
        const deposito = new Date(c.fecha_deposito);
        let cuotasVencidas = 0;
        for (let i = 1; i <= c.num_cuotas; i++) {
          const due = new Date(deposito);
          due.setMonth(due.getMonth() + i);
          if (due <= today) cuotasVencidas++;
          else break;
        }
        const mora = cuotasVencidas - Number(c.pagos_hechos);
        return { ...c, mora, saldo: mora > 0 ? mora * Number(c.valor_cuota) : 0 };
      })
      .filter((c: any) => c.mora > 0)
      .sort((a: any, b: any) => b.saldo - a.saldo)
      .slice(0, 5);

    // Enrich top deudores with nombre
    const deudores: any[] = [];
    for (const d of topDeudores) {
      const [[row]] = await pool.query(
        'SELECT nombre_comprador AS nombre, descripcion_lote AS lote FROM clientes WHERE id = ?',
        [d.id]
      ) as any;
      if (row) deudores.push({ nombre: row.nombre, lote: row.lote, saldo: d.saldo });
    }

    return res.json({
      success: true,
      data: {
        kpi: {
          total_cobrado:   totalCobrado,
          total_pendiente: totalPendiente,
          total_vencido:   totalVencido,
          tasa_cobranza:   tasa,
          clientes_en_mora: clientesEnMora,
        },
        bar:      barRows,
        donut:    donutRows,
        activity: activity,
        deudores: deudores,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

// GET /api/stats/reportes  (data for the reportes page)
router.get('/reportes', async (req, res) => {
  const empresaId = req.user!.empresaId;

  try {
    // Monthly totals last 6 months
    const [monthly] = await pool.query(`
      SELECT
        DATE_FORMAT(fecha_pago, '%b %Y') AS mes,
        DATE_FORMAT(fecha_pago, '%Y-%m') AS mes_key,
        COALESCE(SUM(CASE WHEN estado IN ('pagado','liquidado') THEN monto ELSE 0 END), 0) AS cobrado,
        COALESCE(SUM(CASE WHEN estado = 'pendiente'             THEN monto ELSE 0 END), 0) AS pendiente,
        COALESCE(SUM(CASE WHEN estado = 'vencido'              THEN monto ELSE 0 END), 0) AS vencido
      FROM pagos
      WHERE empresa_id = ? AND fecha_pago >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY mes_key, mes
      ORDER BY mes_key ASC
    `, [empresaId]) as any;

    // Propietarios with balance
    const [propietarios] = await pool.query(`
      SELECT
        pr.nombre,
        l.clave AS lote,
        COALESCE(SUM(CASE WHEN p.estado IN ('pagado','liquidado') THEN p.monto ELSE 0 END), 0) AS pagado,
        COALESCE(SUM(CASE WHEN p.estado IN ('pendiente','vencido') THEN p.monto ELSE 0 END), 0) AS saldo
      FROM propietarios pr
      JOIN contratos c ON c.propietario_id = pr.id AND c.empresa_id = ?
      JOIN lotes l     ON l.id = c.lote_id
      LEFT JOIN pagos p ON p.contrato_id = c.id
      GROUP BY pr.id, pr.nombre, l.clave
      ORDER BY saldo DESC
      LIMIT 20
    `, [empresaId]) as any;

    return res.json({ success: true, data: { monthly, propietarios } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Error al obtener reportes' });
  }
});

export default router;
