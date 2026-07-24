import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { croquisEnabledMiddleware } from '../../middlewares/croquis.middleware.js';
import * as ctrl from './croquis.controller.js';

/**
 * /api/croquis — endpoints autenticados para el editor del dueño. Se requiere
 * que la empresa tenga el add-on activo (Empresa.tieneCroquis) — el super-admin
 * lo controla desde su panel.
 * La vista pública (sin auth ni gate) vive en /api/publico/croquis/:token —
 * si el dueño ya generó un link antes de perder el add-on, el token deja de
 * funcionar cuando se apaga publico_activo desde el editor; el gate del
 * add-on protege que no pueda seguir editando.
 */
const router = Router();
router.use(authMiddleware, croquisEnabledMiddleware);

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
