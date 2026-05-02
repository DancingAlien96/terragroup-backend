import pool from '../../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface UserRecord {
  id: number;
  empresa_id: number;
  nombre: string;
  email: string;
  username: string;
  password: string;
  rol: 'admin' | 'vendedor' | 'supervisor';
  activo: 0 | 1;
}

export interface UserWithPlan extends Omit<UserRecord, 'password' | 'activo'> {
  empresa_nombre: string;
  plan: 'basico' | 'profesional' | 'empresarial';
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const [rows] = await pool.query('SELECT * FROM usuarios WHERE username = ? LIMIT 1', [username]);
  const results = rows as UserRecord[];
  return results.length > 0 ? results[0] : null;
}

export async function getUserWithPlan(userId: number): Promise<UserWithPlan | null> {
  const [rows] = await pool.query(
    `SELECT u.id, u.empresa_id, u.nombre, u.email, u.username, u.rol,
            e.nombre AS empresa_nombre, p.nombre AS plan
     FROM usuarios u
     JOIN empresas e ON e.id = u.empresa_id
     JOIN planes   p ON p.id = e.plan_id
     WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  const results = rows as UserWithPlan[];
  return results.length > 0 ? results[0] : null;
}

export async function verifyPassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}

export function signJwt(user: UserRecord) {
  const payload = {
    sub: user.id,
    empresaId: user.empresa_id,
    rol: user.rol,
    username: user.username,
  };

  const secret = process.env.JWT_SECRET ?? 'secret';
  return jwt.sign(
    payload,
    secret as jwt.Secret,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions,
  );
}

export function parseJwt(token: string) {
  const secret = process.env.JWT_SECRET ?? 'secret';
  return jwt.verify(token, secret as jwt.Secret);
}
