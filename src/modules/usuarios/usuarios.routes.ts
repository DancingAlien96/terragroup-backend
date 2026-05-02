import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { list, get, create, update, remove } from './usuarios.controller.js';

const router = Router();
router.use(authMiddleware);

router.get('/',     list);
router.get('/:id',  get);
router.post('/',    create);
router.put('/:id',  update);
router.delete('/:id', remove);

export default router;
