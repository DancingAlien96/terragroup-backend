/**
 * seed-cartera.ts — Datos de prueba para Cartera Vencida
 * Inserta clientes con fecha_deposito en el pasado y pagos parciales
 * para que aparezcan cuotas vencidas en la sección de Cartera Vencida.
 *
 * Uso: npx tsx src/seed-cartera.ts
 * Opcional: EMPRESA_ID=2 npx tsx src/seed-cartera.ts
 */

import pool from './config/database.js';

async function seedCartera() {
  const conn = await pool.getConnection();

  try {
    console.log('🌱 Seed Cartera Vencida...\n');

    // Detectar empresa a usar
    const empresaIdEnv = process.env.EMPRESA_ID ? Number(process.env.EMPRESA_ID) : null;

    const [empresaRows] = await conn.execute<any[]>(
      empresaIdEnv
        ? 'SELECT id, nombre FROM empresas WHERE id = ? LIMIT 1'
        : 'SELECT id, nombre FROM empresas ORDER BY id LIMIT 1',
      empresaIdEnv ? [empresaIdEnv] : [],
    );

    if (!empresaRows.length) {
      console.error('❌ No se encontró ninguna empresa. Ejecuta el seed principal primero.');
      process.exit(1);
    }

    const empresaId: number = empresaRows[0].id;
    console.log(`📦 Empresa: ${empresaRows[0].nombre} (id=${empresaId})\n`);

    // Fecha base: hoy
    const hoy = new Date();

    function fechaPasada(mesesAtras: number): string {
      const d = new Date(hoy);
      d.setMonth(d.getMonth() - mesesAtras);
      return d.toISOString().split('T')[0];
    }

    // Clientes de prueba con fecha_deposito en el pasado
    const clientes = [
      {
        nombre_comprador: 'Ana Beatriz Lopez',
        descripcion_lote: 'Lote 101 Manzana A',
        precio_neto: 90000,
        enganche: 5000,
        num_cuotas: 24,
        valor_cuota: 3541.67,
        fecha_deposito: fechaPasada(4), // deposito hace 4 meses → cuotas 1,2,3 vencidas
        num_transferencia: 'TRF-001',
        entidad_bancaria: 'Banrural',
        pagos_a_insertar: 1, // solo pagó cuota 1 → cuotas 2 y 3 vencidas
      },
      {
        nombre_comprador: 'Pedro Ramirez Castro',
        descripcion_lote: 'Lote 205 Manzana B',
        precio_neto: 60000,
        enganche: 3000,
        num_cuotas: 12,
        valor_cuota: 4750,
        fecha_deposito: fechaPasada(5), // deposito hace 5 meses → cuotas 1-4 vencidas
        num_transferencia: 'TRF-002',
        entidad_bancaria: 'Industrial',
        pagos_a_insertar: 2, // pagó 2 cuotas → cuotas 3 y 4 vencidas
      },
      {
        nombre_comprador: 'Maria Elena Soto',
        descripcion_lote: 'Lote 312 Manzana C',
        precio_neto: 45000,
        enganche: 2000,
        num_cuotas: 36,
        valor_cuota: 1194.44,
        fecha_deposito: fechaPasada(2), // deposito hace 2 meses → cuota 1 vencida
        num_transferencia: 'TRF-003',
        entidad_bancaria: 'G&T',
        pagos_a_insertar: 0, // no ha pagado nada → cuota 1 vencida
      },
    ];

    for (const c of clientes) {
      // Insertar cliente (INSERT IGNORE por idempotencia)
      const [res] = await conn.execute<any>(
        `INSERT IGNORE INTO clientes
           (empresa_id, nombre_comprador, descripcion_lote, precio_neto, enganche,
            num_cuotas, valor_cuota, fecha_deposito, num_transferencia, entidad_bancaria)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

      let clienteId: number = res.insertId;
      if (!clienteId) {
        // Ya existía — obtener el id
        const [rows] = await conn.execute<any[]>(
          'SELECT id FROM clientes WHERE empresa_id = ? AND nombre_comprador = ? LIMIT 1',
          [empresaId, c.nombre_comprador],
        );
        if (!rows.length) continue;
        clienteId = rows[0].id;
        // Borrar pagos anteriores para este cliente para que el seed sea idempotente
        await conn.execute('DELETE FROM pagos WHERE empresa_id = ? AND cliente_id = ?', [empresaId, clienteId]);
      }

      // Insertar pagos (cuotas pagadas)
      const deposito = new Date(c.fecha_deposito);
      for (let i = 1; i <= c.pagos_a_insertar; i++) {
        const fechaVenc = new Date(deposito);
        fechaVenc.setMonth(fechaVenc.getMonth() + i);

        // Pagó unos días antes del vencimiento
        const fechaPago = new Date(fechaVenc);
        fechaPago.setDate(fechaPago.getDate() - 3);

        await conn.execute(
          `INSERT INTO pagos
             (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento,
              estado, metodo_pago, referencia)
           VALUES (?, ?, ?, ?, ?, ?, 'pagado', 'Deposito', ?)`,
          [
            empresaId,
            clienteId,
            i,
            c.valor_cuota,
            fechaPago.toISOString().split('T')[0],
            fechaVenc.toISOString().split('T')[0],
            `REF-${clienteId}-C${i}`,
          ],
        );
      }

      const cuotasVencidas = Math.max(0, (new Date() > deposito ? Math.floor((hoy.getTime() - deposito.getTime()) / (30.44 * 24 * 60 * 60 * 1000)) : 0) - c.pagos_a_insertar);
      console.log(`✅ ${c.nombre_comprador}`);
      console.log(`   Deposito: ${c.fecha_deposito} | Pagos: ${c.pagos_a_insertar} | Cuotas vencidas aprox: ${cuotasVencidas}`);
    }

    console.log('\n✔  Seed cartera completado. Recarga /dashboard/cartera para ver los resultados.');
  } catch (err) {
    console.error('❌ Error en seed-cartera:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seedCartera();
