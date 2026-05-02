import pool from '../../config/database.js';

export interface VendedorRow {
  id: number;
  nombre: string;
  email: string;
  username: string;
  activo: boolean;
  lotes_asignados: number;
  lotes_vendidos: number;
  comision_porcentaje: number;
  total_comisiones: number;
  comisiones_pendientes: number;
  ultima_venta: string | null;
}

export interface ComisionRow {
  id: number;
  empresa_id: number;
  vendedor_id: number;
  vendedor_nombre: string;
  pago_id: number;
  propietario_nombre: string;
  lote_clave: string;
  monto_pago: number;
  porcentaje: number;
  monto: number;
  pagada: boolean;
  created_at: string;
}

export async function listVendedores(empresaId: number): Promise<VendedorRow[]> {
  const [rows] = await pool.query(
    `SELECT
       u.id, u.nombre, u.email, u.username, u.activo,
       COUNT(DISTINCT c.id) AS lotes_asignados,
       COUNT(DISTINCT CASE WHEN c.estado = 'activo' OR c.estado = 'liquidado' THEN c.lote_id END) AS lotes_vendidos,
       COALESCE(AVG(vc.porcentaje), 0) AS comision_porcentaje,
       COALESCE(SUM(vc.monto), 0) AS total_comisiones,
       COALESCE(SUM(CASE WHEN vc.pagada = 0 THEN vc.monto ELSE 0 END), 0) AS comisiones_pendientes,
       MAX(c.created_at) AS ultima_venta
     FROM usuarios u
     LEFT JOIN contratos c ON c.vendedor_id = u.id AND c.empresa_id = u.empresa_id
     LEFT JOIN vendedores_comisiones vc ON vc.vendedor_id = u.id AND vc.empresa_id = u.empresa_id
     WHERE u.empresa_id = ? AND u.rol = 'vendedor'
     GROUP BY u.id
     ORDER BY u.nombre ASC`,
    [empresaId],
  );
  return rows as VendedorRow[];
}

export async function listComisiones(empresaId: number): Promise<ComisionRow[]> {
  const [rows] = await pool.query(
    `SELECT vc.*, u.nombre AS vendedor_nombre,
            p.nombre AS propietario_nombre,
            l.clave AS lote_clave,
            pg.monto AS monto_pago
     FROM vendedores_comisiones vc
     JOIN usuarios u ON u.id = vc.vendedor_id
     JOIN pagos pg ON pg.id = vc.pago_id
     JOIN propietarios p ON p.id = pg.propietario_id
     JOIN contratos c ON c.id = pg.contrato_id
     JOIN lotes l ON l.id = c.lote_id
     WHERE vc.empresa_id = ?
     ORDER BY vc.created_at DESC`,
    [empresaId],
  );
  return rows as ComisionRow[];
}

export async function createComision(
  empresaId: number,
  data: { vendedor_id: number; pago_id: number; porcentaje: number; monto: number },
): Promise<ComisionRow> {
  const [result] = await pool.query(
    `INSERT INTO vendedores_comisiones (empresa_id, vendedor_id, pago_id, porcentaje, monto)
     VALUES (?, ?, ?, ?, ?)`,
    [empresaId, data.vendedor_id, data.pago_id, data.porcentaje, data.monto],
  ) as any;
  const [rows] = await pool.query(
    `SELECT vc.*, u.nombre AS vendedor_nombre,
            p.nombre AS propietario_nombre, l.clave AS lote_clave, pg.monto AS monto_pago
     FROM vendedores_comisiones vc
     JOIN usuarios u ON u.id = vc.vendedor_id
     JOIN pagos pg ON pg.id = vc.pago_id
     JOIN propietarios p ON p.id = pg.propietario_id
     JOIN contratos c ON c.id = pg.contrato_id
     JOIN lotes l ON l.id = c.lote_id
     WHERE vc.id = ? LIMIT 1`,
    [result.insertId],
  );
  return (rows as ComisionRow[])[0];
}

export async function toggleComisionPagada(id: number, empresaId: number): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT pagada FROM vendedores_comisiones WHERE id = ? AND empresa_id = ? LIMIT 1`,
    [id, empresaId],
  ) as any;
  if ((rows as any[]).length === 0) return false;
  const current = (rows as any[])[0].pagada;
  await pool.query(
    `UPDATE vendedores_comisiones SET pagada = ? WHERE id = ? AND empresa_id = ?`,
    [current ? 0 : 1, id, empresaId],
  );
  return true;
}
