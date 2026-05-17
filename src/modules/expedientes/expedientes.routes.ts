import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as ctrl from './expedientes.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/',       ctrl.list);
router.post('/',      ctrl.create);
router.delete('/:id', ctrl.remove);

export default router;
