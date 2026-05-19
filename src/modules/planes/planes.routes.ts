import { Router } from 'express';
import prisma from '../../config/prisma.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const planes = await prisma.plan.findMany({ orderBy: { precio: 'asc' } });
    return res.json({ success: true, data: planes });
  } catch {
    return res.status(500).json({ success: false, message: 'Error al obtener planes' });
  }
});

export default router;
