-- AlterTable
ALTER TABLE `pagos` ADD COLUMN `num_recibo` INTEGER NULL;

-- AlterTable
ALTER TABLE `propietarios` ADD COLUMN `nit` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `usuario_id` INTEGER NULL,
    `entidad` VARCHAR(50) NOT NULL,
    `entidad_id` INTEGER NOT NULL,
    `accion` VARCHAR(20) NOT NULL,
    `descripcion` VARCHAR(500) NULL,
    `cambios` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_empresa_id_created_at_idx`(`empresa_id`, `created_at`),
    INDEX `audit_logs_empresa_id_entidad_entidad_id_idx`(`empresa_id`, `entidad`, `entidad_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
