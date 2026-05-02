/**
 * seed.ts — Datos de prueba para TerraGroup
 * Crea 3 empresas con distintos planes y sus usuarios admin.
 *
 * Uso: npx tsx src/seed.ts
 */

import bcrypt from 'bcryptjs';
import pool from './config/database.js';

const SALT = 12;

const empresas = [
  {
    nombre: 'Lotificaciones del Norte S.A.',
    rfc: 'LNO901201AA1',
    planNombre: 'basico',
    usuario: {
      nombre: 'Carlos Mendoza',
      email: 'carlos@lotenorte.com',
      username: 'carlos_norte',
      password: 'Admin123!',
      rol: 'admin' as const,
    },
  },
  {
    nombre: 'Terrenos Pacífico S.R.L.',
    rfc: 'TPA150305BB2',
    planNombre: 'profesional',
    usuario: {
      nombre: 'María Rivas',
      email: 'maria@terrapacifico.com',
      username: 'maria_pacifico',
      password: 'Admin123!',
      rol: 'admin' as const,
    },
  },
  {
    nombre: 'Desarrollos San Pablo Corp.',
    rfc: 'DSP200810CC3',
    planNombre: 'empresarial',
    usuario: {
      nombre: 'Roberto Fuentes',
      email: 'roberto@sanpablo.com',
      username: 'roberto_sp',
      password: 'Admin123!',
      rol: 'admin' as const,
    },
  },
];

async function seed() {
  const conn = await pool.getConnection();

  try {
    console.log('🌱 Iniciando seed...\n');

    for (const data of empresas) {
      // 1. Obtener plan_id
      const [planRows] = await conn.execute<any[]>(
        'SELECT id FROM planes WHERE nombre = ? LIMIT 1',
        [data.planNombre],
      );

      if (!planRows.length) {
        console.error(`❌ Plan "${data.planNombre}" no encontrado. Ejecuta init.sql primero.`);
        continue;
      }

      const planId: number = planRows[0].id;

      // 2. Insertar empresa (INSERT IGNORE para idempotencia)
      await conn.execute(
        `INSERT IGNORE INTO empresas (nombre, rfc, plan_id, activo, fecha_inicio, fecha_vence)
         VALUES (?, ?, ?, TRUE, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR))`,
        [data.nombre, data.rfc, planId],
      );

      const [empresaRows] = await conn.execute<any[]>(
        'SELECT id FROM empresas WHERE rfc = ? LIMIT 1',
        [data.rfc],
      );
      const empresaId: number = empresaRows[0].id;

      // 3. Hashear contraseña e insertar usuario
      const hash = await bcrypt.hash(data.usuario.password, SALT);

      await conn.execute(
        `INSERT IGNORE INTO usuarios (empresa_id, nombre, email, username, password, rol, activo)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
        [
          empresaId,
          data.usuario.nombre,
          data.usuario.email,
          data.usuario.username,
          hash,
          data.usuario.rol,
        ],
      );

      console.log(`✅ Empresa: ${data.nombre}`);
      console.log(`   Plan: ${data.planNombre} | empresa_id: ${empresaId}`);
      console.log(`   Usuario: ${data.usuario.username} | Contraseña: ${data.usuario.password}\n`);
    }

    console.log('✔  Seed completado.');
  } catch (err) {
    console.error('❌ Error en seed:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
