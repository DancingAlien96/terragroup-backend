import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { list } from './cartera.controller.js';

const router = Router();
router.use(authMiddleware);
router.get('/', list);

export default router;
