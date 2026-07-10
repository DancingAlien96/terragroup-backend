-- ─────────────────────────────────────────────────────────────────
-- Vincula cada venta a un proyecto. Necesario para que Business (que
-- puede tener 2+ proyectos) pueda separar sus ventas por proyecto.
--
-- Backfill: asigna todas las ventas existentes al primer proyecto activo
-- de cada empresa (típicamente el "Principal" creado en la migración
-- anterior).
-- ─────────────────────────────────────────────────────────────────

-- 1. Agregar proyecto_id nullable temporalmente
ALTER TABLE `ventas` ADD COLUMN `proyecto_id` INTEGER NULL;

-- 2. Backfill: asignar al primer proyecto de cada empresa
UPDATE `ventas` v
INNER JOIN (
  SELECT `empresa_id`, MIN(`id`) AS first_proyecto_id
  FROM `proyectos`
  WHERE `activo` = 1
  GROUP BY `empresa_id`
) p ON p.`empresa_id` = v.`empresa_id`
SET v.`proyecto_id` = p.first_proyecto_id;

-- 3. Verificación defensiva: si alguna venta quedó sin proyecto (empresa
--    sin proyectos activos, caso raro), la asignamos a cualquier proyecto
--    de la misma empresa aunque esté inactivo.
UPDATE `ventas` v
INNER JOIN (
  SELECT `empresa_id`, MIN(`id`) AS first_proyecto_id
  FROM `proyectos`
  GROUP BY `empresa_id`
) p ON p.`empresa_id` = v.`empresa_id`
SET v.`proyecto_id` = p.first_proyecto_id
WHERE v.`proyecto_id` IS NULL;

-- 4. Hacer NOT NULL + FK + índice
ALTER TABLE `ventas` MODIFY COLUMN `proyecto_id` INTEGER NOT NULL;
ALTER TABLE `ventas` ADD CONSTRAINT `ventas_proyecto_id_fkey`
  FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX `ventas_proyecto_id_idx` ON `ventas`(`proyecto_id`);
