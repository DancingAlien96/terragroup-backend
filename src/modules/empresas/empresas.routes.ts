import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { superadminMiddleware } from '../../middlewares/superadmin.middleware.js';
import { registerLimiter } from '../../middlewares/rateLimit.middleware.js';
import * as ctrl from './empresas.controller.js';

const router = Router();

// Público: registro de nueva empresa
router.post('/register', registerLimiter, ctrl.register);

// Público: consulta de estado para polling tras pago (solo devuelve {id, activo}).
router.get('/:id/estado', ctrl.getEstadoEmpresa);

// Solo super-admin
router.get('/',              authMiddleware, superadminMiddleware, ctrl.listEmpresas);
router.get('/stats',         authMiddleware, superadminMiddleware, ctrl.getGlobalStats);
router.get('/:id',           authMiddleware, superadminMiddleware, ctrl.getEmpresa);
router.put('/:id',           authMiddleware, superadminMiddleware, ctrl.updateEmpresa);
router.patch('/:id/toggle',  authMiddleware, superadminMiddleware, ctrl.toggleEmpresa);
router.patch('/:id/plan',    authMiddleware, superadminMiddleware, ctrl.updateEmpresaPlan);

export default router;
