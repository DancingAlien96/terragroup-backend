import pool from '../../config/database.js';

export interface ContratoRow {
  id: number;
  empresa_id: number;
  propietario_id: number;
  lote_id: number;
  vendedor_id: number;
  precio_total: number;
  enganche: number;
  mensualidad: number;
  num_mensualidades: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: 'activo' | 'liquidado' | 'cancelado';
  created_at: string;
  updated_at: string;
}

export interface ContratoDetalle extends ContratoRow {
  propietario_nombre: string;
  propietario_telefono: string | null;
  propietario_email: string | null;
  propietario_estado_cuenta: string;
  lote_clave: string;
  vendedor_nombre: string;
  total_pagado: number;
  total_pendiente: number;
}

export async function listContratos(empresaId: number): Promise<ContratoDetalle[]> {
  const [rows] = await pool.query(
    `SELECT c.*,
            p.nombre AS propietario_nombre,
            p.telefono AS propietario_telefono,
            p.email AS propietario_email,
            p.estado_cuenta AS propietario_estado_cuenta,
            l.clave AS lote_clave,
            u.nombre AS vendedor_nombre,
            COALESCE(SUM(CASE WHEN pg.estado = 'pagado' THEN pg.monto ELSE 0 END), 0) AS total_pagado,
            COALESCE(SUM(CASE WHEN pg.estado IN ('pendiente','vencido') THEN pg.monto ELSE 0 END), 0) AS total_pendiente
     FROM contratos c
     JOIN propietarios p ON p.id = c.propietario_id
     JOIN lotes l ON l.id = c.lote_id
     JOIN usuarios u ON u.id = c.vendedor_id
     LEFT JOIN pagos pg ON pg.contrato_id = c.id
     WHERE c.empresa_id = ?
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [empresaId],
  );
  return rows as ContratoDetalle[];
}

export async function getContrato(id: number, empresaId: number): Promise<ContratoDetalle | null> {
  const [rows] = await pool.query(
    `SELECT c.*,
            p.nombre AS propietario_nombre,
            p.telefono AS propietario_telefono,
            p.email AS propietario_email,
            p.estado_cuenta AS propietario_estado_cuenta,
            l.clave AS lote_clave,
            u.nombre AS vendedor_nombre,
            COALESCE(SUM(CASE WHEN pg.estado = 'pagado' THEN pg.monto ELSE 0 END), 0) AS total_pagado,
            COALESCE(SUM(CASE WHEN pg.estado IN ('pendiente','vencido') THEN pg.monto ELSE 0 END), 0) AS total_pendiente
     FROM contratos c
     JOIN propietarios p ON p.id = c.propietario_id
     JOIN lotes l ON l.id = c.lote_id
     JOIN usuarios u ON u.id = c.vendedor_id
     LEFT JOIN pagos pg ON pg.contrato_id = c.id
     WHERE c.id = ? AND c.empresa_id = ?
     GROUP BY c.id LIMIT 1`,
    [id, empresaId],
  );
  const results = rows as ContratoDetalle[];
  return results.length > 0 ? results[0] : null;
}

export async function createContrato(
  empresaId: number,
  data: {
    propietario_id: number;
    lote_id: number;
    vendedor_id: number;
    precio_total: number;
    enganche: number;
    mensualidad: number;
    num_mensualidades: number;
    fecha_inicio: string;
    fecha_fin?: string;
  },
): Promise<ContratoDetalle> {
  const [result] = await pool.query(
    `INSERT INTO contratos
       (empresa_id, propietario_id, lote_id, vendedor_id, precio_total, enganche,
        mensualidad, num_mensualidades, fecha_inicio, fecha_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresaId, data.propietario_id, data.lote_id, data.vendedor_id,
      data.precio_total, data.enganche, data.mensualidad, data.num_mensualidades,
      data.fecha_inicio, data.fecha_fin ?? null,
    ],
  ) as any;
  // Mark lote as vendido
  await pool.query(`UPDATE lotes SET estado = 'vendido' WHERE id = ?`, [data.lote_id]);
  return (await getContrato(result.insertId, empresaId))!;
}

export async function updateContrato(
  id: number,
  empresaId: number,
  data: Partial<{
    precio_total: number; enganche: number; mensualidad: number;
    num_mensualidades: number; fecha_inicio: string; fecha_fin: string; estado: string;
  }>,
): Promise<ContratoDetalle | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.precio_total !== undefined)      { fields.push('precio_total = ?');      values.push(data.precio_total); }
  if (data.enganche !== undefined)          { fields.push('enganche = ?');          values.push(data.enganche); }
  if (data.mensualidad !== undefined)       { fields.push('mensualidad = ?');       values.push(data.mensualidad); }
  if (data.num_mensualidades !== undefined) { fields.push('num_mensualidades = ?'); values.push(data.num_mensualidades); }
  if (data.fecha_inicio !== undefined)      { fields.push('fecha_inicio = ?');      values.push(data.fecha_inicio); }
  if (data.fecha_fin !== undefined)         { fields.push('fecha_fin = ?');         values.push(data.fecha_fin); }
  if (data.estado !== undefined)            { fields.push('estado = ?');            values.push(data.estado); }

  if (fields.length > 0) {
    values.push(id, empresaId);
    await pool.query(
      `UPDATE contratos SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      values,
    );
  }
  return getContrato(id, empresaId);
}

export async function deleteContrato(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(
    `DELETE FROM contratos WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}
