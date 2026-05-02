import { findUserByUsername, verifyPassword, signJwt } from './auth.service.js';
export async function login(req, res) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }
    const user = await findUserByUsername(username);
    if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    const passwordMatches = await verifyPassword(password, user.password);
    if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
    if (!user.activo) {
        return res.status(403).json({ success: false, message: 'User is inactive' });
    }
    const token = signJwt(user);
    const responseUser = {
        id: user.id,
        empresaId: user.empresa_id,
        nombre: user.nombre,
        email: user.email,
        username: user.username,
        rol: user.rol,
    };
    return res.json({ success: true, data: { token, user: responseUser } });
}
export function logout(_req, res) {
    return res.json({ success: true, message: 'Logged out successfully' });
}
export function me(req, res) {
    return res.json({ success: true, data: { user: req.user } });
}
//# sourceMappingURL=auth.controller.js.map