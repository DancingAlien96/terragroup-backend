import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as ctrl from './amortizacion.controller.js';

const router = Router();
router.use(authMiddleware);

router.post('/simular',                  ctrl.simular);
router.get ('/venta/:ventaId',           ctrl.getPlanByVenta);
router.post('/venta/:ventaId/regenerar', ctrl.regenerar);

export default router;
