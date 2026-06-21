import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import prisma from './config/prisma.js';
import { UPLOADS_DIR } from './utils/files.js';
import uploadsRoutes from './modules/uploads/uploads.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import usuariosRoutes from './modules/usuarios/usuarios.routes.js';
import lotesRoutes from './modules/lotes/lotes.routes.js';
import propietariosRoutes from './modules/propietarios/propietarios.routes.js';
import pagosRoutes from './modules/pagos/pagos.routes.js';
import vendedoresRoutes from './modules/vendedores/vendedores.routes.js';
import notificacionesRoutes from './modules/notificaciones/notificaciones.routes.js';
import carteraRoutes from './modules/cartera/cartera.routes.js';
import empresasRoutes from './modules/empresas/empresas.routes.js';
import planesRoutes from './modules/planes/planes.routes.js';
import statsRoutes from './modules/stats/stats.routes.js';
import ventasRoutes from './modules/ventas/ventas.routes.js';
import expedientesRoutes from './modules/expedientes/expedientes.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import amortizacionRoutes from './modules/amortizacion/amortizacion.routes.js';

dotenv.config();

const app = express();

/**
 * CORS: solo permite orígenes en CORS_ORIGINS (CSV).
 * Si CORS_ORIGINS no está definido, en desarrollo permite localhost; en prod bloquea.
 * Requests sin origen (curl, mobile apps, mismo-origen) se permiten.
 */
const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);
const isDev = process.env.NODE_ENV !== 'production';
const devFallback = ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);                       // server-to-server / curl
    const list = allowedOrigins.length > 0 ? allowedOrigins : (isDev ? devFallback : []);
    if (list.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS: origen no permitido (${origin})`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Forzar UTF-8 en respuestas JSON (solo en /api). NO aplicar globalmente:
// express.static no sobreescribe Content-Type si ya está seteado, así que un
// header global rompe la entrega de imágenes/PDFs en /uploads.
app.use('/api', (_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/api/auth',           authRoutes);
app.use('/api/usuarios',       usuariosRoutes);
app.use('/api/lotes',          lotesRoutes);
app.use('/api/propietarios',   propietariosRoutes);
app.use('/api/pagos',          pagosRoutes);
app.use('/api/vendedores',     vendedoresRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/cartera',        carteraRoutes);
app.use('/api/empresas',       empresasRoutes);
app.use('/api/planes',         planesRoutes);
app.use('/api/stats',          statsRoutes);
app.use('/api/ventas',         ventasRoutes);
app.use('/api/expedientes',    expedientesRoutes);
app.use('/api/amortizacion',   amortizacionRoutes);
app.use('/api/audit',          auditRoutes);
app.use('/api/uploads',        uploadsRoutes);

// Servir archivos subidos como estáticos. Los URLs son UUIDs no adivinables.
// Headers de seguridad:
//   - X-Content-Type-Options: nosniff → el browser no infiere MIME (bloquea
//     ejecutar HTML/SVG disfrazado de imagen).
//   - Content-Security-Policy con sandbox → si por algún motivo el contenido
//     se renderiza como HTML, no puede ejecutar scripts ni acceder a cookies.
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  index:  false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    res.setHeader('Referrer-Policy', 'no-referrer');
  },
}));

app.get('/', (_req, res) => {
  res.json({ success: true, message: 'TerraGroup backend running' });
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, database: 'ok' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database connection failed', error: String(error) });
  }
});

export default app;
