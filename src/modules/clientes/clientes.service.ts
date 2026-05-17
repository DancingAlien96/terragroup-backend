import pool from '../../config/database.js';

export interface ClienteRow {
  id: number;
  empresa_id: number;
  nombre_comprador: string;
  email: string | null;
  telefono: string | null;
  descripcion_lote: string | null;
  precio_neto: number;
  enganche: number;
  num_cuotas: number;
  valor_cuota: number;
  cuota_inicio: number;
  fecha_deposito: string;
  num_transferencia: string | null;
  metodo_pago: string | null;
  entidad_bancaria: 'Banrural' | 'Industrial' | 'G&T' | 'BAC' | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export async function listClientes(empresaId: number): Promise<ClienteRow[]> {
  const [rows] = await pool.query(
    `SELECT * FROM clientes WHERE empresa_id = ? AND activo = TRUE ORDER BY nombre_comprador ASC`,
    [empresaId],
  );
  return rows as ClienteRow[];
}

export async function getCliente(id: number, empresaId: number): Promise<ClienteRow | null> {
  const [rows] = await pool.query(
    `SELECT * FROM clientes WHERE id = ? AND empresa_id = ? LIMIT 1`,
    [id, empresaId],
  );
  const results = rows as ClienteRow[];
  return results.length > 0 ? results[0] : null;
}

export async function createCliente(
  empresaId: number,
  data: {
    nombre_comprador: string;
    email?: string | null;
    telefono?: string | null;
    descripcion_lote?: string | null;
    precio_neto: number;
    enganche: number;
    num_cuotas: number;
    valor_cuota: number;
    fecha_deposito: string;
    cuota_inicio?: number;
    num_transferencia?: string | null;
    metodo_pago?: string | null;
    entidad_bancaria?: string | null;
  },
): Promise<ClienteRow> {
  const [result] = await pool.query(
    `INSERT INTO clientes
       (empresa_id, nombre_comprador, email, telefono, descripcion_lote, precio_neto, enganche,
        num_cuotas, valor_cuota, cuota_inicio, fecha_deposito, num_transferencia, metodo_pago, entidad_bancaria)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresaId, data.nombre_comprador, data.email ?? null, data.telefono ?? null,
      data.descripcion_lote ?? null,
      data.precio_neto, data.enganche, data.num_cuotas, data.valor_cuota,
      data.cuota_inicio ?? 1,
      data.fecha_deposito, data.num_transferencia ?? null, data.metodo_pago ?? null, data.entidad_bancaria ?? null,
    ],
  ) as any;

  const newCliente = (await getCliente(result.insertId, empresaId))!;
  await autoGenerarCuotas(newCliente.id, empresaId, newCliente);
  return newCliente;
}

/** Genera los registros pendientes SOLO para cuotas ya vencidas (idempotente). */
async function autoGenerarCuotas(clienteId: number, empresaId: number, c: ClienteRow) {
  const today = new Date();
  today.setHours(23, 59, 59, 0);

  const [existing] = await pool.query(
    `SELECT num_cuota FROM pagos WHERE cliente_id = ? AND empresa_id = ?`,
    [clienteId, empresaId],
  ) as any;
  const existingNums = new Set((existing as any[]).map((r: any) => r.num_cuota));

  const rows: unknown[][] = [];
  const deposito = new Date(c.fecha_deposito);

  for (let i = c.cuota_inicio; i <= c.num_cuotas; i++) {
    const due = new Date(deposito);
    due.setMonth(due.getMonth() + i);
    if (due > today) break; // solo cuotas ya vencidas
    if (existingNums.has(i)) continue;
    rows.push([empresaId, clienteId, i, c.valor_cuota, due.toISOString().split('T')[0], 'pendiente']);
  }

  if (rows.length > 0) {
    await pool.query(
      `INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_vencimiento, estado) VALUES ?`,
      [rows],
    );
  }
}

export async function updateCliente(
  id: number,
  empresaId: number,
  data: Partial<{
    nombre_comprador: string;
    email: string | null;
    telefono: string | null;
    descripcion_lote: string | null;
    precio_neto: number;
    enganche: number;
    num_cuotas: number;
    valor_cuota: number;
    cuota_inicio: number;
    fecha_deposito: string;
    num_transferencia: string | null;
    entidad_bancaria: string | null;
    metodo_pago: string | null;
    activo: boolean;
  }>,
): Promise<ClienteRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.nombre_comprador !== undefined)  { fields.push('nombre_comprador = ?');  values.push(data.nombre_comprador); }
  if (data.email !== undefined)             { fields.push('email = ?');             values.push(data.email); }
  if (data.telefono !== undefined)          { fields.push('telefono = ?');          values.push(data.telefono); }
  if (data.descripcion_lote !== undefined)  { fields.push('descripcion_lote = ?');  values.push(data.descripcion_lote); }
  if (data.precio_neto !== undefined)       { fields.push('precio_neto = ?');       values.push(data.precio_neto); }
  if (data.enganche !== undefined)          { fields.push('enganche = ?');          values.push(data.enganche); }
  if (data.num_cuotas !== undefined)        { fields.push('num_cuotas = ?');        values.push(data.num_cuotas); }
  if (data.valor_cuota !== undefined)       { fields.push('valor_cuota = ?');       values.push(data.valor_cuota); }
  if (data.cuota_inicio !== undefined)      { fields.push('cuota_inicio = ?');      values.push(data.cuota_inicio); }
  if (data.fecha_deposito !== undefined)    { fields.push('fecha_deposito = ?');    values.push(data.fecha_deposito); }
  if (data.num_transferencia !== undefined) { fields.push('num_transferencia = ?'); values.push(data.num_transferencia); }
  if (data.metodo_pago !== undefined)       { fields.push('metodo_pago = ?');       values.push(data.metodo_pago); }
  if (data.entidad_bancaria !== undefined)  { fields.push('entidad_bancaria = ?');  values.push(data.entidad_bancaria); }
  if (data.activo !== undefined)            { fields.push('activo = ?');            values.push(data.activo); }

  if (fields.length > 0) {
    values.push(id, empresaId);
    await pool.query(
      `UPDATE clientes SET ${fields.join(', ')} WHERE id = ? AND empresa_id = ?`,
      values,
    );
  }
  return getCliente(id, empresaId);
}

export async function deleteCliente(id: number, empresaId: number): Promise<boolean> {
  // Eliminar pagos asociados primero (cascade explícito para BDs existentes)
  await pool.query(
    `DELETE FROM pagos WHERE cliente_id = ? AND empresa_id = ?`,
    [id, empresaId],
  );
  const [result] = await pool.query(
    `DELETE FROM clientes WHERE id = ? AND empresa_id = ?`,
    [id, empresaId],
  ) as any;
  return result.affectedRows > 0;
}
