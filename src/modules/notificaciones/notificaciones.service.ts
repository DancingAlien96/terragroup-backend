import pool from '../../config/database.js';

export interface NotificacionRow {
  id: number;
  empresa_id: number;
  usuario_id: number;
  titulo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
  updated_at: string;
  usuario_nombre?: string;
}

export async function listNotificaciones(empresaId: number): Promise<NotificacionRow[]> {
  const [rows] = await pool.query(
    `SELECT n.*, u.nombre AS usuario_nombre
     FROM notificaciones n
     JOIN usuarios u ON u.id = n.usuario_id
     WHERE n.empresa_id = ?
     ORDER BY n.created_at DESC`,
    [empresaId],
  );
  return rows as NotificacionRow[];
}

export async function getNotificacion(id: number, empresaId: number): Promise<NotificacionRow | null> {
  const [rows] = await pool.query(
    `SELECT n.*, u.nombre AS usuario_nombre
     FROM notificaciones n
     JOIN usuarios u ON u.id = n.usuario_id
     WHERE n.id = ? AND n.empresa_id = ? LIMIT 1`,
    [id, empresaId],
  );
  const results = rows as NotificacionRow[];
  return results.length > 0 ? results[0] : null;
}

export async function createNotificacion(
  empresaId: number,
  data: { usuario_id: number; titulo: string; mensaje: string },
): Promise<NotificacionRow> {
  const [result] = await pool.query(
    `INSERT INTO notificaciones (empresa_id, usuario_id, titulo, mensaje)
     VALUES (?, ?, ?, ?)`,
    [empresaId, data.usuario_id, data.titulo, data.mensaje],
  ) as any;
  return (await getNotificacion(result.insertId, empresaId))!;
}

export async function marcarLeida(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(
    `UPDATE notificaciones SET leida = 1 WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}

export async function deleteNotificacion(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(
    `DELETE FROM notificaciones WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}
