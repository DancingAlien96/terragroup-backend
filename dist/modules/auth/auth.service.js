import pool from '../../config/database.js';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
export async function findUserByUsername(username) {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE username = ? LIMIT 1', [username]);
    const results = rows;
    return results.length > 0 ? results[0] : null;
}
export async function verifyPassword(password, hashed) {
    return bcrypt.compare(password, hashed);
}
export function signJwt(user) {
    const payload = {
        sub: user.id,
        empresaId: user.empresa_id,
        rol: user.rol,
        username: user.username,
    };
    const secret = process.env.JWT_SECRET ?? 'secret';
    return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' });
}
export function parseJwt(token) {
    const secret = process.env.JWT_SECRET ?? 'secret';
    return jwt.verify(token, secret);
}
//# sourceMappingURL=auth.service.js.map