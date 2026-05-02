import { verify } from 'jsonwebtoken';
export function authMiddleware(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Missing or invalid authorization header' });
    }
    const token = authorization.replace('Bearer ', '');
    try {
        const payload = verify(token, process.env.JWT_SECRET ?? 'secret');
        req.user = {
            id: payload.sub,
            empresaId: payload.empresaId,
            rol: payload.rol,
            username: payload.username,
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
}
//# sourceMappingURL=auth.middleware.js.map