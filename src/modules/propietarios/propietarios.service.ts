import pool from '../../config/database.js';

export interface PropietarioRow {
  id: number;
  empresa_id: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  estado_cuenta: 'al_dia' | 'moroso' | 'vencido' | 'liquidado';
  created_at: string;
  updated_at: string;
}

export async function listPropietarios(empresaId: number): Promise<PropietarioRow[]> {
  const [rows] = await pool.query(
    `SELECT * FROM propietarios WHERE empresa_id = ? ORDER BY nombre ASC`,
    [empresaId],
  );
  return rows as PropietarioRow[];
}

export async function getPropietario(id: number, empresaId: number): Promise<PropietarioRow | null> {
  const [rows] = await pool.query(
    `SELECT * FROM propietarios WHERE id = ? AND empresa_id = ? LIMIT 1`,
    [id, empresaId],
  );
  const results = rows as PropietarioRow[];
  return results.length > 0 ? results[0] : null;
}

export async function createPropietario(
  empresaId: number,
  data: { nombre: string; telefono?: string; email?: string; direccion?: string },
): Promise<PropietarioRow> {
  const [result] = await pool.query(
    `INSERT INTO propietarios (empresa_id, nombre, telefono, email, direccion)
     VALUES (?, ?, ?, ?, ?)`,
    [empresaId, data.nombre, data.telefono ?? null, data.email ?? null, data.direccion ?? null],
  ) as any;
  return (await getPropietario(result.insertId, empresaId))!;
}

export async function updatePropietario(
  id: number,
  empresaId: number,
  data: Partial<{ nombre: string; telefono: string; email: string; direccion: string; estado_cuenta: string }>,
): Promise<PropietarioRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.nombre !== undefined)        { fields.push('nombre = ?');        values.push(data.nombre); }
  if (data.telefono !== undefined)      { fields.push('telefono = ?');      values.push(data.telefono); }
  if (data.email !== undefined)         { fields.push('email = ?');         values.push(data.email); }
  if (data.direccion !== undefined)     { fields.push('direccion = ?');     values.push(data.direccion); }
  if (data.estado_cuenta !== undefined) { fields.push('estado_cuenta = ?'); values.push(data.estado_cuenta); }

  if (fields.length > 0) {
    values.push(id, empresaId);
    await pool.query(
      `UPDATE propietarios SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      values,
    );
  }
  return getPropietario(id, empresaId);
}

export async function deletePropietario(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(
    `DELETE FROM propietarios WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}
