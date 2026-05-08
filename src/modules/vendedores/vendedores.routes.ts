import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { list, create, update, remove, listComisiones, createComision, updateComision, removeComision } from './vendedores.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);
router.get('/:id/comisiones', listComisiones);
router.post('/:id/comisiones', createComision);
router.put('/:id/comisiones/:comisionId', updateComision);
router.delete('/:id/comisiones/:comisionId', removeComision);

export default router;
