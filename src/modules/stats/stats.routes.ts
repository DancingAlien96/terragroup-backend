import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import pool from '../../config/database.js';

const router = Router();
router.use(authMiddleware);

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
  const empresaId = req.user!.empresaId;

  try {
    // KPI totals from pagos
    const [[kpi]] = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN estado IN ('pagado','liquidado') THEN monto ELSE 0 END), 0) AS total_cobrado,
        COALESCE(SUM(CASE WHEN estado = 'pendiente'             THEN monto ELSE 0 END), 0) AS total_pendiente,
        COALESCE(SUM(CASE WHEN estado = 'vencido'              THEN monto ELSE 0 END), 0) AS total_vencido,
        COUNT(*)                                                                            AS total_pagos,
        SUM(CASE WHEN estado IN ('pagado','liquidado') THEN 1 ELSE 0 END)                  AS pagos_cobrados
      FROM pagos WHERE empresa_id = ?
    `, [empresaId]) as any;

    const tasa = kpi.total_pagos > 0
      ? ((kpi.pagos_cobrados / kpi.total_pagos) * 100).toFixed(1)
      : '0.0';

    // Last 6 months bar chart
    const [barRows] = await pool.query(`
      SELECT
        DATE_FORMAT(fecha_pago, '%b %Y')                                                      AS mes,
        DATE_FORMAT(fecha_pago, '%Y-%m')                                                      AS mes_key,
        COALESCE(SUM(CASE WHEN estado IN ('pagado','liquidado') THEN monto ELSE 0 END), 0)    AS cobrado,
        COALESCE(SUM(CASE WHEN estado IN ('pendiente','vencido') THEN monto ELSE 0 END), 0)   AS pendiente
      FROM pagos
      WHERE empresa_id = ? AND fecha_pago >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY mes_key, mes
      ORDER BY mes_key ASC
      LIMIT 6
    `, [empresaId]) as any;

    // Donut: contratos by status
    const [donutRows] = await pool.query(`
      SELECT estado, COUNT(*) AS total
      FROM contratos
      WHERE empresa_id = ?
      GROUP BY estado
    `, [empresaId]) as any;

    // Recent activity: last 5 pagos with propietario name
    const [activity] = await pool.query(`
      SELECT p.id, p.monto, p.estado, p.fecha_pago,
             pr.nombre AS propietario, l.clave AS lote
      FROM pagos p
      JOIN contratos c  ON c.id = p.contrato_id
      JOIN propietarios pr ON pr.id = c.propietario_id
      JOIN lotes l        ON l.id = c.lote_id
      WHERE p.empresa_id = ?
      ORDER BY p.created_at DESC
      LIMIT 5
    `, [empresaId]) as any;

    // Top deudores: propietarios with highest vencido balance
    const [deudores] = await pool.query(`
      SELECT pr.nombre, SUM(p.monto) AS saldo
      FROM pagos p
      JOIN contratos c     ON c.id = p.contrato_id
      JOIN propietarios pr ON pr.id = c.propietario_id
      WHERE p.empresa_id = ? AND p.estado = 'vencido'
      GROUP BY pr.id, pr.nombre
      ORDER BY saldo DESC
      LIMIT 5
    `, [empresaId]) as any;

    return res.json({
      success: true,
      data: {
        kpi: {
          total_cobrado:   Number(kpi.total_cobrado),
          total_pendiente: Number(kpi.total_pendiente),
          total_vencido:   Number(kpi.total_vencido),
          tasa_cobranza:   tasa,
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
