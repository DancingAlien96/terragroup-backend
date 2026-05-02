import pool from '../../config/database.js';
import bcrypt from 'bcryptjs';

export interface UsuarioRow {
  id: number;
  empresa_id: number;
  nombre: string;
  email: string;
  username: string;
  rol: 'admin' | 'vendedor' | 'supervisor';
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export async function listUsuarios(empresaId: number): Promise<UsuarioRow[]> {
  const [rows] = await pool.query(
    `SELECT id, empresa_id, nombre, email, username, rol, activo, created_at, updated_at
     FROM usuarios WHERE empresa_id = ? ORDER BY nombre ASC`,
    [empresaId],
  );
  return rows as UsuarioRow[];
}

export async function getUsuario(id: number, empresaId: number): Promise<UsuarioRow | null> {
  const [rows] = await pool.query(
    `SELECT id, empresa_id, nombre, email, username, rol, activo, created_at, updated_at
     FROM usuarios WHERE id = ? AND empresa_id = ? LIMIT 1`,
    [id, empresaId],
  );
  const results = rows as UsuarioRow[];
  return results.length > 0 ? results[0] : null;
}

export async function createUsuario(
  empresaId: number,
  data: { nombre: string; email: string; username: string; password: string; rol: string },
): Promise<UsuarioRow> {
  const hashed = await bcrypt.hash(data.password, 10);
  const [result] = await pool.query(
    `INSERT INTO usuarios (empresa_id, nombre, email, username, password, rol)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [empresaId, data.nombre, data.email, data.username, hashed, data.rol],
  ) as any;
  const inserted = await getUsuario(result.insertId, empresaId);
  return inserted!;
}

export async function updateUsuario(
  id: number,
  empresaId: number,
  data: Partial<{ nombre: string; email: string; username: string; rol: string; activo: boolean; password: string }>,
): Promise<UsuarioRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.nombre !== undefined)   { fields.push('nombre = ?');   values.push(data.nombre); }
  if (data.email !== undefined)    { fields.push('email = ?');    values.push(data.email); }
  if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username); }
  if (data.rol !== undefined)      { fields.push('rol = ?');      values.push(data.rol); }
  if (data.activo !== undefined)   { fields.push('activo = ?');   values.push(data.activo ? 1 : 0); }
  if (data.password !== undefined) {
    const hashed = await bcrypt.hash(data.password, 10);
    fields.push('password = ?');
    values.push(hashed);
  }

  if (fields.length === 0) return getUsuario(id, empresaId);

  values.push(id, empresaId);
  await pool.query(
    `UPDATE usuarios SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`,
    values,
  );
  return getUsuario(id, empresaId);
}

export async function deleteUsuario(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(
    `DELETE FROM usuarios WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}
