import pool from '../../config/database.js';

export interface PagoRow {
  id: number;
  empresa_id: number;
  contrato_id: number;
  propietario_id: number;
  monto: number;
  fecha_pago: string | null;
  fecha_vencimiento: string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  metodo_pago: string | null;
  referencia: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagoDetalle extends PagoRow {
  propietario_nombre: string;
  lote_clave: string;
}

export async function listPagos(empresaId: number): Promise<PagoDetalle[]> {
  const [rows] = await pool.query(
    `SELECT pg.*, p.nombre AS propietario_nombre, l.clave AS lote_clave
     FROM pagos pg
     JOIN propietarios p ON p.id = pg.propietario_id
     JOIN contratos c ON c.id = pg.contrato_id
     JOIN lotes l ON l.id = c.lote_id
     WHERE pg.empresa_id = ?
     ORDER BY pg.fecha_vencimiento DESC`,
    [empresaId],
  );
  return rows as PagoDetalle[];
}

export async function getPago(id: number, empresaId: number): Promise<PagoDetalle | null> {
  const [rows] = await pool.query(
    `SELECT pg.*, p.nombre AS propietario_nombre, l.clave AS lote_clave
     FROM pagos pg
     JOIN propietarios p ON p.id = pg.propietario_id
     JOIN contratos c ON c.id = pg.contrato_id
     JOIN lotes l ON l.id = c.lote_id
     WHERE pg.id = ? AND pg.empresa_id = ? LIMIT 1`,
    [id, empresaId],
  );
  const results = rows as PagoDetalle[];
  return results.length > 0 ? results[0] : null;
}

export async function createPago(
  empresaId: number,
  data: {
    contrato_id: number;
    propietario_id: number;
    monto: number;
    fecha_vencimiento: string;
    fecha_pago?: string;
    estado?: string;
    metodo_pago?: string;
    referencia?: string;
  },
): Promise<PagoDetalle> {
  const [result] = await pool.query(
    `INSERT INTO pagos
       (empresa_id, contrato_id, propietario_id, monto, fecha_vencimiento,
        fecha_pago, estado, metodo_pago, referencia)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresaId, data.contrato_id, data.propietario_id, data.monto,
      data.fecha_vencimiento, data.fecha_pago ?? null,
      data.estado ?? 'pendiente', data.metodo_pago ?? null, data.referencia ?? null,
    ],
  ) as any;
  return (await getPago(result.insertId, empresaId))!;
}

export async function updatePago(
  id: number,
  empresaId: number,
  data: Partial<{
    monto: number; fecha_vencimiento: string; fecha_pago: string;
    estado: string; metodo_pago: string; referencia: string;
  }>,
): Promise<PagoDetalle | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.monto !== undefined)             { fields.push('monto = ?');             values.push(data.monto); }
  if (data.fecha_vencimiento !== undefined) { fields.push('fecha_vencimiento = ?'); values.push(data.fecha_vencimiento); }
  if (data.fecha_pago !== undefined)        { fields.push('fecha_pago = ?');        values.push(data.fecha_pago); }
  if (data.estado !== undefined)            { fields.push('estado = ?');            values.push(data.estado); }
  if (data.metodo_pago !== undefined)       { fields.push('metodo_pago = ?');       values.push(data.metodo_pago); }
  if (data.referencia !== undefined)        { fields.push('referencia = ?');        values.push(data.referencia); }

  if (fields.length > 0) {
    values.push(id, empresaId);
    await pool.query(
      `UPDATE pagos SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      values,
    );
  }

  // Auto-update propietario estado_cuenta based on payments
  const pago = await getPago(id, empresaId);
  if (pago) {
    const [stats] = await pool.query(
      `SELECT
         SUM(CASE WHEN estado = 'vencido' THEN 1 ELSE 0 END) AS vencidos,
         SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
         SUM(CASE WHEN estado = 'pagado' THEN 1 ELSE 0 END) AS pagados,
         COUNT(*) AS total
       FROM pagos WHERE propietario_id = ? AND empresa_id = ?`,
      [pago.propietario_id, empresaId],
    ) as any;
    const s = (stats as any[])[0];
    let estadoCuenta = 'al_dia';
    if (s.vencidos > 2) estadoCuenta = 'vencido';
    else if (s.vencidos > 0) estadoCuenta = 'moroso';
    else if (s.pagados === s.total && s.total > 0) estadoCuenta = 'liquidado';
    await pool.query(
      `UPDATE propietarios SET estado_cuenta = ? WHERE id = ? AND empresa_id = ?`,
      [estadoCuenta, pago.propietario_id, empresaId],
    );
  }

  return pago;
}

export async function deletePago(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(
    `DELETE FROM pagos WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}
