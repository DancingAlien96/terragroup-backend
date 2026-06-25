-- AlterTable: agrega campos del ciclo de vida de la suscripción SaaS con trial
ALTER TABLE `empresas`
  ADD COLUMN `suscripcion_id` VARCHAR(100) NULL,
  ADD COLUMN `estado_suscripcion` ENUM('pendiente', 'trial', 'pagada', 'pago_fallido', 'cancelada') NOT NULL DEFAULT 'pendiente',
  ADD COLUMN `trial_inicio` DATETIME(3) NULL,
  ADD COLUMN `trial_fin` DATETIME(3) NULL;

-- Backfill: empresas que ya estaban activas con pagoSuscripcionId se marcan como pagadas
-- para no romper el modelo viejo (las que vienen del flujo one-time).
UPDATE `empresas`
SET `estado_suscripcion` = 'pagada'
WHERE `activo` = 1 AND `pago_suscripcion_id` IS NOT NULL;
