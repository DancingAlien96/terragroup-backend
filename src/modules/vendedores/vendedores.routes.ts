import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { listVendedores, listComisiones, createComision, togglePagada } from './vendedores.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/',                    listVendedores);
router.get('/comisiones',          listComisiones);
router.post('/comisiones',         createComision);
router.patch('/comisiones/:id/toggle', togglePagada);

export default router;
