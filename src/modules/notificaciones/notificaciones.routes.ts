import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { list, create, leer, remove } from './notificaciones.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/',           list);
router.post('/',          create);
router.patch('/:id/leer', leer);
router.delete('/:id',     remove);

export default router;
