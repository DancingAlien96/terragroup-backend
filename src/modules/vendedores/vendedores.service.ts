import pool from '../../config/database.js';

export interface VendedorRow {
  id: number;
  empresa_id: number;
  nombre: string;
  edad: number | null;
  telefono: string | null;
  email: string | null;
  dpi: string | null;
  direccion: string | null;
  activo: boolean;
  total_ventas: number;
  total_comisiones: number;
}

export interface ComisionRow {
  id: number;
  empresa_id: number;
  vendedor_id: number;
  vendedor_nombre: string;
  descripcion_lote: string;
  porcentaje: number;
  monto_comision: number;
  fecha_venta: string;
  created_at: string;
}

export async function listVendedores(empresaId: number): Promise<VendedorRow[]> {
  const [rows] = await pool.query(
    `SELECT v.*,
       COUNT(c.id) AS total_ventas,
       COALESCE(SUM(c.monto_comision), 0) AS total_comisiones
     FROM vendedores v
     LEFT JOIN comisiones c ON c.vendedor_id = v.id AND c.empresa_id = v.empresa_id
     WHERE v.empresa_id = ?
     GROUP BY v.id
     ORDER BY v.nombre ASC`,
    [empresaId],
  );
  return rows as VendedorRow[];
}

export async function getVendedor(id: number, empresaId: number): Promise<VendedorRow | null> {
  const [rows] = await pool.query(
    `SELECT v.*,
       COUNT(c.id) AS total_ventas,
       COALESCE(SUM(c.monto_comision), 0) AS total_comisiones
     FROM vendedores v
     LEFT JOIN comisiones c ON c.vendedor_id = v.id AND c.empresa_id = v.empresa_id
     WHERE v.id = ? AND v.empresa_id = ?
     GROUP BY v.id`,
    [id, empresaId],
  );
  return (rows as VendedorRow[])[0] ?? null;
}

export async function createVendedor(
  empresaId: number,
  data: { nombre: string; edad?: number | null; telefono?: string | null; email?: string | null; dpi?: string | null; direccion?: string | null },
): Promise<VendedorRow> {
  const [result] = await pool.query(
    `INSERT INTO vendedores (empresa_id, nombre, edad, telefono, email, dpi, direccion) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [empresaId, data.nombre, data.edad ?? null, data.telefono ?? null, data.email ?? null, data.dpi ?? null, data.direccion ?? null],
  ) as any;
  return (await getVendedor(result.insertId, empresaId))!;
}

export async function updateVendedor(
  id: number,
  empresaId: number,
  data: Partial<{ nombre: string; edad: number | null; telefono: string | null; email: string | null; dpi: string | null; direccion: string | null; activo: boolean }>,
): Promise<VendedorRow | null> {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.nombre !== undefined)    { fields.push('nombre = ?');    values.push(data.nombre); }
  if (data.edad !== undefined)      { fields.push('edad = ?');      values.push(data.edad); }
  if (data.telefono !== undefined)  { fields.push('telefono = ?');  values.push(data.telefono); }
  if (data.email !== undefined)     { fields.push('email = ?');     values.push(data.email); }
  if (data.dpi !== undefined)       { fields.push('dpi = ?');       values.push(data.dpi); }
  if (data.direccion !== undefined) { fields.push('direccion = ?'); values.push(data.direccion); }
  if (data.activo !== undefined)    { fields.push('activo = ?');    values.push(data.activo); }
  if (!fields.length) return getVendedor(id, empresaId);
  await pool.query(`UPDATE vendedores SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`, [...values, id, empresaId]);
  return getVendedor(id, empresaId);
}

export async function deleteVendedor(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(`DELETE FROM vendedores WHERE id = ? AND empresa_id = ?`, [id, empresaId]) as any;
  return result.affectedRows > 0;
}

export async function listComisiones(vendedorId: number, empresaId: number): Promise<ComisionRow[]> {
  const [rows] = await pool.query(
    `SELECT c.*, v.nombre AS vendedor_nombre
     FROM comisiones c
     JOIN vendedores v ON v.id = c.vendedor_id
     WHERE c.vendedor_id = ? AND c.empresa_id = ?
     ORDER BY c.fecha_venta DESC`,
    [vendedorId, empresaId],
  );
  return rows as ComisionRow[];
}

export async function createComision(
  empresaId: number,
  vendedorId: number,
  data: { descripcion_lote: string; porcentaje: number; monto_comision: number; fecha_venta: string },
): Promise<ComisionRow> {
  const [result] = await pool.query(
    `INSERT INTO comisiones (empresa_id, vendedor_id, descripcion_lote, porcentaje, monto_comision, fecha_venta) VALUES (?, ?, ?, ?, ?, ?)`,
    [empresaId, vendedorId, data.descripcion_lote, data.porcentaje, data.monto_comision, data.fecha_venta],
  ) as any;
  const [rows] = await pool.query(
    `SELECT c.*, v.nombre AS vendedor_nombre FROM comisiones c JOIN vendedores v ON v.id = c.vendedor_id WHERE c.id = ?`,
    [result.insertId],
  );
  return (rows as ComisionRow[])[0];
}

export async function deleteComision(id: number, empresaId: number): Promise<boolean> {
  const [result] = await pool.query(`DELETE FROM comisiones WHERE id = ? AND empresa_id = ?`, [id, empresaId]) as any;
  return result.affectedRows > 0;
}

