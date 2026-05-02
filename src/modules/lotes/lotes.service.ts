import pool from '../../config/database.js';

export interface LoteRow {
  id: number;
  empresa_id: number;
  clave: string;
  manzana: string | null;
  numero: string | null;
  superficie: number | null;
  precio_venta: number | null;
  estado: 'disponible' | 'vendido' | 'reservado';
  created_at: string;
  updated_at: string;
}

export async function listLotes(empresaId: number): Promise<LoteRow[]> {
  const [rows] = await pool.query(
    `SELECT * FROM lotes WHERE empresa_id = ? ORDER BY clave ASC`,
    [empresaId],
  );
  return rows as LoteRow[];
}

export async function getLote(id: number, empresaId: number): Promise<LoteRow | null> {
  const [rows] = await pool.query(
    `SELECT * FROM lotes WHERE id = ? AND empresa_id = ? LIMIT 1`,
    [id, empresaId],
  );
  const results = rows as LoteRow[];
  return results.length > 0 ? results[0] : null;
}

export async function createLote(
  empresaId: number,
  data: { clave: string; manzana?: string; numero?: string; superficie?: number; precio_venta?: number; estado?: string },
): Promise<LoteRow> {
  const [result] = await pool.query(
    `INSERT INTO lotes (empresa_id, clave, manzana, numero, superficie, precio_venta, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [empresaId, data.clave, data.manzana ?? null, data.numero ?? null,
     data.superficie ?? null, data.precio_venta ?? null, data.estado ?? 'disponible'],
  ) as any;
  return (await getLote(result.insertId, empresaId))!;
}

export async function updateLote(
  id: number,
  empresaId: number,
  data: Partial<{ clave: string; manzana: string; numero: string; superficie: number; precio_venta: number; estado: string }>,
): Promise<LoteRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.clave !== undefined)        { fields.push('clave = ?');        values.push(data.clave); }
  if (data.manzana !== undefined)      { fields.push('manzana = ?');      values.push(data.manzana); }
  if (data.numero !== undefined)       { fields.push('numero = ?');       values.push(data.numero); }
  if (data.superficie !== undefined)   { fields.push('superficie = ?');   values.push(data.superficie); }
  if (data.precio_venta !== undefined) { fields.push('precio_venta = ?'); values.push(data.precio_venta); }
  if (data.estado !== undefined)       { fields.push('estado = ?');       values.push(data.estado); }

  if (fields.length > 0) {
    values.push(id, empresaId);
    await pool.query(
      `UPDATE lotes SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      values,
    );
  }
  return getLote(id, empresaId);
}

export async function deleteLote(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(
    `DELETE FROM lotes WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}
