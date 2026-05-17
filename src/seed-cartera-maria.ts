/**
 * seed-cartera-maria.ts — Cartera Vencida para maria_pacifico (empresa_id=3)
 * Inserta clientes con fecha_deposito en el pasado y pagos parciales.
 *
 * Uso: npx tsx src/seed-cartera-maria.ts
 */

import pool from './config/database.js';

async function seedCarteraMaria() {
  const conn = await pool.getConnection();

  try {
    console.log('🌱 Seed Cartera Vencida — Terrenos Pacífico (empresa_id=3)\n');

    const empresaId = 3;

    const hoy = new Date();

    function fechaPasada(mesesAtras: number): string {
      const d = new Date(hoy);
      d.setMonth(d.getMonth() - mesesAtras);
      return d.toISOString().split('T')[0];
    }

    const clientes = [
      {
        nombre_comprador: 'Roberto Aguilar Vega',
        descripcion_lote: 'Lote 5 Manzana D',
        precio_neto: 80000,
        enganche: 8000,
        num_cuotas: 24,
        valor_cuota: 3000,
        fecha_deposito: fechaPasada(6), // hace 6 meses → cuotas 1-5 vencidas
        num_transferencia: 'TRF-M001',
        entidad_bancaria: 'Banrural' as const,
        pagos_a_insertar: 2, // pagó 2 → 3 cuotas vencidas sin pagar
      },
      {
        nombre_comprador: 'Luisa Fernanda Pérez',
        descripcion_lote: 'Lote 14 Manzana A',
        precio_neto: 55000,
        enganche: 5000,
        num_cuotas: 18,
        valor_cuota: 2777.78,
        fecha_deposito: fechaPasada(4), // hace 4 meses → cuotas 1-3 vencidas
        num_transferencia: 'TRF-M002',
        entidad_bancaria: 'Industrial' as const,
        pagos_a_insertar: 1, // pagó 1 → 2 cuotas vencidas sin pagar
      },
      {
        nombre_comprador: 'Diego Castillo Ruiz',
        descripcion_lote: 'Lote 8 Manzana E',
        precio_neto: 120000,
        enganche: 10000,
        num_cuotas: 36,
        valor_cuota: 3055.56,
        fecha_deposito: fechaPasada(8), // hace 8 meses → cuotas 1-7 vencidas
        num_transferencia: 'TRF-M003',
        entidad_bancaria: 'G&T' as const,
        pagos_a_insertar: 3, // pagó 3 → 4 cuotas vencidas sin pagar (mora grave >90 días)
      },
    ];

    for (const c of clientes) {
      // Verificar si ya existe
      const [existing] = await conn.execute<any[]>(
        'SELECT id FROM clientes WHERE empresa_id=? AND nombre_comprador=? AND descripcion_lote=? LIMIT 1',
        [empresaId, c.nombre_comprador, c.descripcion_lote],
      );

      let clienteId: number;

      if (existing.length > 0) {
        clienteId = existing[0].id;
        console.log(`⚠️  Cliente ya existe: ${c.nombre_comprador} (id=${clienteId}), omitiendo inserción.`);
      } else {
        const [res] = await conn.execute<any>(
          `INSERT INTO clientes
            (empresa_id, nombre_comprador, descripcion_lote, precio_neto, enganche,
             num_cuotas, valor_cuota, fecha_deposito, num_transferencia, entidad_bancaria, activo)
           VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
          [
            empresaId,
            c.nombre_comprador,
            c.descripcion_lote,
            c.precio_neto,
            c.enganche,
            c.num_cuotas,
            c.valor_cuota,
            c.fecha_deposito,
            c.num_transferencia,
            c.entidad_bancaria,
          ],
        );
        clienteId = res.insertId;
        console.log(`✅ Cliente insertado: ${c.nombre_comprador} (id=${clienteId})`);
      }

      // Insertar pagos si no existen ya
      const [pagosExistentes] = await conn.execute<any[]>(
        'SELECT COUNT(*) as cnt FROM pagos WHERE cliente_id=? AND empresa_id=?',
        [clienteId, empresaId],
      );

      if (pagosExistentes[0].cnt > 0) {
        console.log(`   ↳ Ya tiene pagos registrados, omitiendo.\n`);
        continue;
      }

      const deposito = new Date(c.fecha_deposito);

      for (let i = 1; i <= c.pagos_a_insertar; i++) {
        const fechaVenc = new Date(deposito);
        fechaVenc.setMonth(fechaVenc.getMonth() + i);
        const fechaVencStr = fechaVenc.toISOString().split('T')[0];

        await conn.execute(
          `INSERT INTO pagos
            (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
           VALUES (?,?,?,?,?,?,'pagado','transferencia')`,
          [empresaId, clienteId, i, c.valor_cuota, fechaVencStr, fechaVencStr],
        );
      }

      console.log(`   ↳ ${c.pagos_a_insertar} pago(s) insertado(s)\n`);
    }

    console.log('✅ Seed completado.\n');
    console.log('Resumen de mora esperada:');
    console.log('  Roberto Aguilar  → 3 cuotas vencidas × Q3,000    = Q 9,000   (mora media)');
    console.log('  Luisa Pérez      → 2 cuotas vencidas × Q2,777.78 = Q 5,555.56 (mora temprana)');
    console.log('  Diego Castillo   → 4 cuotas vencidas × Q3,055.56 = Q 12,222.24 (mora grave)');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    conn.release();
    await pool.end();
  }
}

seedCarteraMaria();
