import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as ctrl from './audit.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', ctrl.list);

export default router;
