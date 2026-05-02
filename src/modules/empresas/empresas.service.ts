import pool from '../../config/database.js';
import bcrypt from 'bcryptjs';
import { signJwt } from '../auth/auth.service.js';

export interface RegisterPayload {
  empresa_nombre: string;
  empresa_email?: string;
  empresa_telefono?: string;
  plan_id: number;
  nombre_admin: string;
  email_admin: string;
  username_admin: string;
  password_admin: string;
}

export interface EmpresaRow {
  id: number;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rfc: string | null;
  plan_id: number;
  plan_nombre: string;
  activo: boolean;
  fecha_inicio: string | null;
  fecha_vence: string | null;
  total_usuarios: number;
  total_lotes: number;
  total_contratos: number;
  created_at: string;
}

/** Registro público: crea empresa + usuario admin en una transacción */
export async function registerEmpresa(data: RegisterPayload) {
  const conn = await (pool as any).getConnection();
  try {
    await conn.beginTransaction();

    // 1. Crear empresa
    const fechaInicio = new Date().toISOString().slice(0, 10);
    const fechaVence = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // 30 días trial
    const [empResult]: any = await conn.query(
      `INSERT INTO empresas (nombre, email, telefono, plan_id, activo, fecha_inicio, fecha_vence)
       VALUES (?, ?, ?, ?, TRUE, ?, ?)`,
      [data.empresa_nombre, data.empresa_email ?? null, data.empresa_telefono ?? null, data.plan_id, fechaInicio, fechaVence],
    );
    const empresaId: number = empResult.insertId;

    // 2. Crear usuario admin
    const hashed = await bcrypt.hash(data.password_admin, 10);
    const [userResult]: any = await conn.query(
      `INSERT INTO usuarios (empresa_id, nombre, email, username, password, rol, activo)
       VALUES (?, ?, ?, ?, ?, 'admin', TRUE)`,
      [empresaId, data.nombre_admin, data.email_admin, data.username_admin, hashed],
    );
    const userId: number = userResult.insertId;

    await conn.commit();

    // 3. Generar token para autologin
    const token = signJwt({ id: userId, empresa_id: empresaId, nombre: data.nombre_admin, email: data.email_admin, username: data.username_admin, password: hashed, rol: 'admin', activo: 1 } as any);

    return { empresaId, userId, token };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Lista todas las empresas con estadísticas (solo super-admin) */
export async function listEmpresas(): Promise<EmpresaRow[]> {
  const [rows] = await pool.query(
    `SELECT e.id, e.nombre, e.email, e.telefono, e.rfc, e.plan_id, pl.nombre AS plan_nombre,
            e.activo, e.fecha_inicio, e.fecha_vence, e.created_at,
            COUNT(DISTINCT u.id) AS total_usuarios,
            COUNT(DISTINCT l.id) AS total_lotes,
            COUNT(DISTINCT c.id) AS total_contratos
     FROM empresas e
     JOIN planes pl ON pl.id = e.plan_id
     LEFT JOIN usuarios u ON u.empresa_id = e.id AND u.rol != 'superadmin'
     LEFT JOIN lotes l ON l.empresa_id = e.id
     LEFT JOIN contratos c ON c.empresa_id = e.id
     GROUP BY e.id
     ORDER BY e.created_at DESC`,
  );
  return rows as EmpresaRow[];
}

export async function getEmpresa(id: number): Promise<EmpresaRow | null> {
  const [rows] = await pool.query(
    `SELECT e.id, e.nombre, e.email, e.telefono, e.rfc, e.plan_id, pl.nombre AS plan_nombre,
            e.activo, e.fecha_inicio, e.fecha_vence, e.created_at,
            COUNT(DISTINCT u.id) AS total_usuarios,
            COUNT(DISTINCT l.id) AS total_lotes,
            COUNT(DISTINCT c.id) AS total_contratos
     FROM empresas e
     JOIN planes pl ON pl.id = e.plan_id
     LEFT JOIN usuarios u ON u.empresa_id = e.id AND u.rol != 'superadmin'
     LEFT JOIN lotes l ON l.empresa_id = e.id
     LEFT JOIN contratos c ON c.empresa_id = e.id
     WHERE e.id = ?
     GROUP BY e.id`,
    [id],
  );
  const rows2 = rows as EmpresaRow[];
  return rows2.length ? rows2[0] : null;
}

export async function toggleEmpresa(id: number): Promise<void> {
  await pool.query('UPDATE empresas SET activo = NOT activo WHERE id = ?', [id]);
}

export async function updateEmpresaPlan(id: number, planId: number): Promise<void> {
  await pool.query('UPDATE empresas SET plan_id = ? WHERE id = ?', [planId, id]);
}

export async function updateEmpresa(id: number, data: Partial<{ nombre: string; email: string; telefono: string; rfc: string; fecha_vence: string }>): Promise<void> {
  const fields = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k]) => `${k} = ?`)
    .join(', ');
  const values = Object.values(data).filter(v => v !== undefined);
  if (!fields) return;
  await pool.query(`UPDATE empresas SET ${fields} WHERE id = ?`, [...values, id]);
}

/** Estadísticas globales para el panel super-admin */
export async function getGlobalStats() {
  const [[stats]]: any = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM empresas WHERE activo = TRUE) AS empresas_activas,
       (SELECT COUNT(*) FROM empresas) AS empresas_total,
       (SELECT COUNT(*) FROM usuarios WHERE rol != 'superadmin') AS usuarios_total,
       (SELECT COUNT(*) FROM contratos) AS contratos_total,
       (SELECT COALESCE(SUM(monto), 0) FROM pagos WHERE estado = 'pagado') AS ingresos_total,
       (SELECT COUNT(*) FROM pagos WHERE estado = 'vencido') AS pagos_vencidos`,
  );
  return stats;
}
