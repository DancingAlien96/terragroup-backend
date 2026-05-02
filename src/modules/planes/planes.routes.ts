import { Router } from 'express';
import pool from '../../config/database.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM planes ORDER BY precio ASC');
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error al obtener planes' });
  }
});

export default router;
