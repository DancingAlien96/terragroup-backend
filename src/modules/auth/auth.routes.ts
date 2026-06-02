import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, me } from './auth.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = Router();

// Rate limit en login: 5 intentos por IP cada 15 minutos.
// Bloquea ataques de fuerza bruta sin afectar al usuario legítimo.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit:    5,
  standardHeaders: 'draft-7',
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.',
  },
});

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);

export default router;
