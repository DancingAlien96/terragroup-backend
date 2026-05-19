import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as ctrl from './ventas.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/',       ctrl.list);
router.get('/:id',    ctrl.get);
router.post('/',      ctrl.create);
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
