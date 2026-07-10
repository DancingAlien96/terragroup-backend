-- ─────────────────────────────────────────────────────────────────
-- Introduce el concepto de "Proyecto" (terreno grande dividido en lotes)
-- y ajusta los planes al nuevo modelo de suscripción mensual.
--
-- Backfill safe: crea un proyecto "Principal" por cada empresa existente
-- y reasigna sus lotes actuales a ese proyecto antes de hacer la FK NOT NULL.
-- ─────────────────────────────────────────────────────────────────

-- 1. Empresa: nuevo campo proyectos_extra
ALTER TABLE `empresas` ADD COLUMN `proyectos_extra` INT NOT NULL DEFAULT 0;

-- 2. Plan: campo max_proyectos
ALTER TABLE `planes` ADD COLUMN `max_proyectos` INT NOT NULL DEFAULT 1;

-- 3. Reprice + rename de planes (basico y profesional → business).
--    basico       $45   → $250, 1 proyecto
--    profesional  $90   → $350, 2 proyectos (renombrado a "business")
--    empresarial se preserva para casos internos (activaciones manuales
--    por soporte, empresas legacy) con maxProyectos alto
UPDATE `planes` SET `precio` = 250, `max_proyectos` = 1                     WHERE `nombre` = 'basico';
UPDATE `planes` SET `precio` = 350, `max_proyectos` = 2, `nombre` = 'business' WHERE `nombre` = 'profesional';
UPDATE `planes` SET `max_proyectos` = 999                                    WHERE `nombre` = 'empresarial';

-- 4. Crear tabla proyectos
CREATE TABLE `proyectos` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `empresa_id` INTEGER NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` TEXT NULL,
  `ubicacion` VARCHAR(255) NULL,
  `activo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uq_proyectos_empresa_nombre`(`empresa_id`, `nombre`),
  INDEX `proyectos_empresa_id_idx`(`empresa_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `proyectos_empresa_id_fkey`
    FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 5. Backfill: crear un proyecto "Principal" para cada empresa existente
INSERT INTO `proyectos` (`empresa_id`, `nombre`, `descripcion`, `updated_at`)
SELECT `id`, 'Principal', 'Proyecto creado automáticamente al migrar a modelo con proyectos', NOW()
FROM `empresas`;

-- 6. Lote: agregar proyecto_id nullable temporalmente
ALTER TABLE `lotes` ADD COLUMN `proyecto_id` INTEGER NULL;

-- 7. Poblar proyecto_id de cada lote con el proyecto "Principal" de su empresa
UPDATE `lotes` l
INNER JOIN `proyectos` p ON p.`empresa_id` = l.`empresa_id` AND p.`nombre` = 'Principal'
SET l.`proyecto_id` = p.`id`;

-- 8. Ahora sí, hacer proyecto_id NOT NULL + agregar FK + índice
ALTER TABLE `lotes` MODIFY COLUMN `proyecto_id` INTEGER NOT NULL;
ALTER TABLE `lotes` ADD CONSTRAINT `lotes_proyecto_id_fkey`
  FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX `lotes_proyecto_id_idx` ON `lotes`(`proyecto_id`);
