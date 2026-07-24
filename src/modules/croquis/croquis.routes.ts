import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as ctrl from './croquis.controller.js';

/**
 * /api/croquis — endpoints autenticados para el editor del dueño.
 * La vista pública (sin auth) vive en /api/publico/croquis/:token (ver
 * croquis.public.routes.ts).
 */
const router = Router();
router.use(authMiddleware);

router.get('/proyecto/:proyectoId',  ctrl.getPorProyecto);
router.post('/proyecto/:proyectoId', ctrl.upsert);

router.patch('/:id/contacto',         ctrl.updateContacto);
router.post('/:id/publico/activar',   ctrl.activarPublico);
router.post('/:id/publico/desactivar', ctrl.desactivarPublico);
router.post('/:id/publico/regenerar', ctrl.regenerarToken);
router.delete('/:id',                 ctrl.remove);

router.patch('/lotes/:loteId/pin',       ctrl.setPin);
router.delete('/lotes/:loteId/pin',      ctrl.quitarPin);
router.patch('/lotes/:loteId/publico',   ctrl.updateVisibilidadPublicaLote);

export default router;
