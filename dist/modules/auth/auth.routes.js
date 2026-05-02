import { Router } from 'express';
import { login, logout, me } from './auth.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
const router = Router();
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);
export default router;
//# sourceMappingURL=auth.routes.js.map