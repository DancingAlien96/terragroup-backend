import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { testConnection } from './config/database.js';
import authRoutes from './modules/auth/auth.routes.js';
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/auth', authRoutes);
app.get('/', (_req, res) => {
    res.json({ success: true, message: 'TerraGroup backend running' });
});
app.get('/health', async (_req, res) => {
    try {
        await testConnection();
        res.json({ success: true, database: 'ok' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Database connection failed', error: String(error) });
    }
});
app.get('/test-query', async (_req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS value');
        res.json({ success: true, data: rows });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Query failed', error: String(error) });
    }
});
export default app;
//# sourceMappingURL=app.js.map