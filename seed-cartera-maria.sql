-- Seed Cartera Vencida para maria_pacifico (empresa_id=3)
-- Fecha base: 2026-05-10

-- Cliente 1: Roberto Aguilar (deposito hace 6 meses = 2025-11-10, 2 pagos)
INSERT IGNORE INTO clientes
  (empresa_id, nombre_comprador, descripcion_lote, precio_neto, enganche,
   num_cuotas, valor_cuota, fecha_deposito, num_transferencia, entidad_bancaria, activo)
VALUES
  (3, 'Roberto Aguilar Vega', 'Lote 5 Manzana D', 80000, 8000,
   24, 3000.00, '2025-11-10', 'TRF-M001', 'Banrural', 1);

SET @rob_id = LAST_INSERT_ID();

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 3, @rob_id, 1, 3000.00, '2025-12-10', '2025-12-10', 'pagado', 'transferencia'
WHERE @rob_id > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@rob_id AND num_cuota=1);

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 3, @rob_id, 2, 3000.00, '2026-01-10', '2026-01-10', 'pagado', 'transferencia'
WHERE @rob_id > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@rob_id AND num_cuota=2);

-- Cliente 2: Luisa Fernanda Pérez (deposito hace 4 meses = 2026-01-10, 1 pago)
INSERT IGNORE INTO clientes
  (empresa_id, nombre_comprador, descripcion_lote, precio_neto, enganche,
   num_cuotas, valor_cuota, fecha_deposito, num_transferencia, entidad_bancaria, activo)
VALUES
  (3, 'Luisa Fernanda Pérez', 'Lote 14 Manzana A', 55000, 5000,
   18, 2777.78, '2026-01-10', 'TRF-M002', 'Industrial', 1);

SET @lui_id = LAST_INSERT_ID();

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 3, @lui_id, 1, 2777.78, '2026-02-10', '2026-02-10', 'pagado', 'transferencia'
WHERE @lui_id > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@lui_id AND num_cuota=1);

-- Cliente 3: Diego Castillo Ruiz (deposito hace 8 meses = 2025-09-10, 3 pagos)
INSERT IGNORE INTO clientes
  (empresa_id, nombre_comprador, descripcion_lote, precio_neto, enganche,
   num_cuotas, valor_cuota, fecha_deposito, num_transferencia, entidad_bancaria, activo)
VALUES
  (3, 'Diego Castillo Ruiz', 'Lote 8 Manzana E', 120000, 10000,
   36, 3055.56, '2025-09-10', 'TRF-M003', 'G&T', 1);

SET @die_id = LAST_INSERT_ID();

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 3, @die_id, 1, 3055.56, '2025-10-10', '2025-10-10', 'pagado', 'transferencia'
WHERE @die_id > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@die_id AND num_cuota=1);

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 3, @die_id, 2, 3055.56, '2025-11-10', '2025-11-10', 'pagado', 'transferencia'
WHERE @die_id > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@die_id AND num_cuota=2);

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 3, @die_id, 3, 3055.56, '2025-12-10', '2025-12-10', 'pagado', 'transferencia'
WHERE @die_id > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@die_id AND num_cuota=3);

SELECT 'Seed completado' AS resultado;
