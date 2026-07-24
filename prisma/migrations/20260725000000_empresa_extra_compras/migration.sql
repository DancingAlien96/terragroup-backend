-- Registro de compras del add-on "proyecto extra" ($50/mes). UNIQUE en
-- intent_id garantiza idempotencia del webhook: si Recurrente reintenta
-- el evento, el segundo insert falla con duplicate key y no se incrementa
-- empresas.proyectos_extra dos veces.

CREATE TABLE `empresa_extra_compras` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `empresa_id` INT          NOT NULL,
  `intent_id`  VARCHAR(100) NOT NULL,
  `created_at` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `empresa_extra_compras_intent_id_key` (`intent_id`),
  INDEX `empresa_extra_compras_empresa_id_idx` (`empresa_id`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `empresa_extra_compras`
  ADD CONSTRAINT `empresa_extra_compras_empresa_id_fkey`
    FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
