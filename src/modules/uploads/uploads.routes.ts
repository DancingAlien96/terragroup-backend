import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { upload } from './uploads.controller.js';

const router = Router();

// Multer en memoria — los archivos no son tan grandes y sharp procesa sobre buffer
const mem = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 12 * 1024 * 1024 },        // 12 MB hard limit; el controller filtra por tipo
});

router.use(authMiddleware);
router.post('/', mem.single('file'), upload);

export default router;
