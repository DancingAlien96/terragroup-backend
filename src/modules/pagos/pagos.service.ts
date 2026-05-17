import pool from '../../config/database.js';

export interface PagoRow {
  id: number;
  empresa_id: number;
  contrato_id: number | null;
  propietario_id: number | null;
  cliente_id: number | null;
  num_cuota: number | null;
  monto: number;
  fecha_pago: string | null;
  fecha_vencimiento: string;
  estado: 'pendiente' | 'pagado' | 'vencido';
  metodo_pago: string | null;
  referencia: string | null;
  comprobante_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagoDetalle extends PagoRow {
  propietario_nombre: string;
  lote_clave: string;
  cliente_nombre_comprador: string | null;
  cliente_descripcion_lote: string | null;
  cliente_num_cuotas: number | null;
}

export async function listPagos(empresaId: number): Promise<PagoDetalle[]> {
  const [rows] = await pool.query(
    `SELECT pg.*,
            COALESCE(p.nombre, '—') AS propietario_nombre,
            COALESCE(l.clave, '\u2014')  AS lote_clave,
            cl.nombre_comprador          AS cliente_nombre_comprador,
            cl.descripcion_lote          AS cliente_descripcion_lote,
            cl.num_cuotas                AS cliente_num_cuotas
     FROM pagos pg
     LEFT JOIN propietarios p ON p.id = pg.propietario_id
     LEFT JOIN contratos c ON c.id = pg.contrato_id
     LEFT JOIN lotes l ON l.id = c.lote_id
     LEFT JOIN clientes cl ON cl.id = pg.cliente_id
     WHERE pg.empresa_id = ?
     ORDER BY pg.fecha_vencimiento DESC`,
    [empresaId],
  );
  return rows as PagoDetalle[];
}

export async function getPago(id: number, empresaId: number): Promise<PagoDetalle | null> {
  const [rows] = await pool.query(
    `SELECT pg.*,
            COALESCE(p.nombre, '—') AS propietario_nombre,
            COALESCE(l.clave, '\u2014')  AS lote_clave,
            cl.nombre_comprador          AS cliente_nombre_comprador,
            cl.descripcion_lote          AS cliente_descripcion_lote,
            cl.num_cuotas                AS cliente_num_cuotas
     FROM pagos pg
     LEFT JOIN propietarios p ON p.id = pg.propietario_id
     LEFT JOIN contratos c ON c.id = pg.contrato_id
     LEFT JOIN lotes l ON l.id = c.lote_id
     LEFT JOIN clientes cl ON cl.id = pg.cliente_id
     WHERE pg.id = ? AND pg.empresa_id = ? LIMIT 1`,
    [id, empresaId],
  );
  const results = rows as PagoDetalle[];
  return results.length > 0 ? results[0] : null;
}

export async function createPago(
  empresaId: number,
  data: {
    contrato_id?: number | null;
    propietario_id?: number | null;
    cliente_id?: number | null;
    monto: number;
    fecha_vencimiento: string;
    fecha_pago?: string;
    estado?: string;
    metodo_pago?: string;
    referencia?: string;
    comprobante_url?: string | null;
  },
): Promise<PagoDetalle> {
  // Auto-detect num_cuota for this cliente, offset by cuota_inicio
  let numCuota: number | null = null;
  if (data.cliente_id) {
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM pagos WHERE cliente_id = ? AND empresa_id = ?`,
      [data.cliente_id, empresaId],
    ) as any;
    const [clienteRows] = await pool.query(
      `SELECT cuota_inicio FROM clientes WHERE id = ? AND empresa_id = ? LIMIT 1`,
      [data.cliente_id, empresaId],
    ) as any;
    const cuotaInicio: number = clienteRows[0]?.cuota_inicio ?? 1;
    numCuota = (countRows[0].total as number) + cuotaInicio;
  }

  const [result] = await pool.query(
    `INSERT INTO pagos
       (empresa_id, contrato_id, propietario_id, cliente_id, num_cuota,
        monto, fecha_vencimiento, fecha_pago, estado, metodo_pago, referencia, comprobante_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresaId, data.contrato_id ?? null, data.propietario_id ?? null,
      data.cliente_id ?? null, numCuota,
      data.monto, data.fecha_vencimiento, data.fecha_pago ?? null,
      'pagado', data.metodo_pago ?? null, data.referencia ?? null, data.comprobante_url ?? null,
    ],
  ) as any;
  return (await getPago(result.insertId, empresaId))!;
}

export async function updatePago(
  id: number,
  empresaId: number,
  data: Partial<{
    cliente_id: number | null;
    monto: number; fecha_vencimiento: string; fecha_pago: string;
    estado: string; metodo_pago: string; referencia: string; comprobante_url: string | null;
  }>,
): Promise<PagoDetalle | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.cliente_id !== undefined)        { fields.push('cliente_id = ?');        values.push(data.cliente_id); }
  if (data.monto !== undefined)             { fields.push('monto = ?');             values.push(data.monto); }
  if (data.fecha_vencimiento !== undefined) { fields.push('fecha_vencimiento = ?'); values.push(data.fecha_vencimiento); }
  if (data.fecha_pago !== undefined)        { fields.push('fecha_pago = ?');        values.push(data.fecha_pago); }
  if (data.estado !== undefined)            { fields.push('estado = ?');            values.push(data.estado); }
  if (data.metodo_pago !== undefined)       { fields.push('metodo_pago = ?');       values.push(data.metodo_pago); }
  if (data.referencia !== undefined)        { fields.push('referencia = ?');        values.push(data.referencia); }
  if (data.comprobante_url !== undefined)   { fields.push('comprobante_url = ?');   values.push(data.comprobante_url); }

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
