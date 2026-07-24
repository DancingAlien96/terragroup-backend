import { Router } from 'express';
import * as ctrl from './croquis.controller.js';

/**
 * Router público sin auth para el link compartible del croquis.
 * Se monta en /api/publico/croquis y solo expone GET /:token.
 */
const router = Router();

router.get('/:token', ctrl.getPublico);

export default router;
