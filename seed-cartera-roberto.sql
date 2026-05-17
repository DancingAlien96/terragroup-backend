-- Seed Cartera Vencida para roberto_sp (empresa_id=4)
-- Fecha base: 2026-05-10

-- Cliente 1: Carlos Mendoza (deposito hace 6 meses = 2025-11-10, 2 pagos)
INSERT IGNORE INTO clientes
  (empresa_id, nombre_comprador, descripcion_lote, precio_neto, enganche,
   num_cuotas, valor_cuota, fecha_deposito, num_transferencia, entidad_bancaria, activo)
VALUES
  (4, 'Carlos Mendoza Pérez', 'Lote 3 Manzana B', 95000, 9500,
   24, 3562.50, '2025-11-10', 'TRF-R001', 'Banrural', 1);

SET @c1 = LAST_INSERT_ID();

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 4, @c1, 1, 3562.50, '2025-12-10', '2025-12-10', 'pagado', 'transferencia'
WHERE @c1 > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@c1 AND num_cuota=1);

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 4, @c1, 2, 3562.50, '2026-01-10', '2026-01-10', 'pagado', 'transferencia'
WHERE @c1 > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@c1 AND num_cuota=2);

-- Cliente 2: Sandra Ramos Ortiz (deposito hace 4 meses = 2026-01-10, 1 pago)
INSERT IGNORE INTO clientes
  (empresa_id, nombre_comprador, descripcion_lote, precio_neto, enganche,
   num_cuotas, valor_cuota, fecha_deposito, num_transferencia, entidad_bancaria, activo)
VALUES
  (4, 'Sandra Ramos Ortiz', 'Lote 22 Manzana C', 65000, 6500,
   18, 3250.00, '2026-01-10', 'TRF-R002', 'Industrial', 1);

SET @c2 = LAST_INSERT_ID();

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 4, @c2, 1, 3250.00, '2026-02-10', '2026-02-10', 'pagado', 'transferencia'
WHERE @c2 > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@c2 AND num_cuota=1);

-- Cliente 3: Héctor Villalobos (deposito hace 9 meses = 2025-08-10, 3 pagos — mora grave)
INSERT IGNORE INTO clientes
  (empresa_id, nombre_comprador, descripcion_lote, precio_neto, enganche,
   num_cuotas, valor_cuota, fecha_deposito, num_transferencia, entidad_bancaria, activo)
VALUES
  (4, 'Héctor Villalobos', 'Lote 7 Manzana A', 140000, 14000,
   36, 3500.00, '2025-08-10', 'TRF-R003', 'G&T', 1);

SET @c3 = LAST_INSERT_ID();

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 4, @c3, 1, 3500.00, '2025-09-10', '2025-09-10', 'pagado', 'transferencia'
WHERE @c3 > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@c3 AND num_cuota=1);

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 4, @c3, 2, 3500.00, '2025-10-10', '2025-10-10', 'pagado', 'transferencia'
WHERE @c3 > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@c3 AND num_cuota=2);

INSERT INTO pagos (empresa_id, cliente_id, num_cuota, monto, fecha_pago, fecha_vencimiento, estado, metodo_pago)
SELECT 4, @c3, 3, 3500.00, '2025-11-10', '2025-11-10', 'pagado', 'transferencia'
WHERE @c3 > 0 AND NOT EXISTS (SELECT 1 FROM pagos WHERE cliente_id=@c3 AND num_cuota=3);

SELECT 'Seed roberto_sp completado' AS resultado;

-- Resumen esperado:
-- Carlos Mendoza  → 4 vencidas - 2 pagadas = 2 cuotas × Q3,562.50 = Q7,125   (mora temprana ~60d)
-- Sandra Ramos    → 3 vencidas - 1 pagada  = 2 cuotas × Q3,250.00 = Q6,500   (mora media ~60d)
-- Héctor Villalobos → 8 vencidas - 3 pagadas = 5 cuotas × Q3,500.00 = Q17,500 (mora grave >90d)
