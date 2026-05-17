import pool from '../../config/database.js';

export interface ExpedienteRow {
  id: number;
  empresa_id: number;
  cliente_id: number;
  nombre: string;
  archivo_url: string;
  created_at: string;
}

export async function listExpedientes(
  empresaId: number,
  clienteId: number,
): Promise<ExpedienteRow[]> {
  const [rows] = await pool.query(
    `SELECT * FROM expedientes WHERE empresa_id = ? AND cliente_id = ? ORDER BY created_at DESC`,
    [empresaId, clienteId],
  );
  return rows as ExpedienteRow[];
}

export async function createExpediente(
  empresaId: number,
  clienteId: number,
  nombre: string,
  archivoUrl: string,
): Promise<ExpedienteRow> {
  const [result] = await pool.query(
    `INSERT INTO expedientes (empresa_id, cliente_id, nombre, archivo_url) VALUES (?, ?, ?, ?)`,
    [empresaId, clienteId, nombre, archivoUrl],
  ) as any;
  const [rows] = await pool.query(
    `SELECT * FROM expedientes WHERE id = ? LIMIT 1`,
    [result.insertId],
  );
  return (rows as ExpedienteRow[])[0];
}

export async function deleteExpediente(
  id: number,
  empresaId: number,
): Promise<boolean> {
  const [result] = await pool.query(
    `DELETE FROM expedientes WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}
