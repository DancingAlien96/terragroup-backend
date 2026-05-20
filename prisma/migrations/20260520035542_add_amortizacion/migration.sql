-- AlterTable
ALTER TABLE `ventas` ADD COLUMN `tasa_anual` DECIMAL(5, 4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `plan_cuotas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `empresa_id` INTEGER NOT NULL,
    `venta_id` INTEGER NOT NULL,
    `num_cuota` INTEGER NOT NULL,
    `anio` INTEGER NOT NULL,
    `fecha_vencimiento` DATE NOT NULL,
    `cuota_referencial` DECIMAL(12, 2) NOT NULL,
    `capital_referencial` DECIMAL(12, 2) NOT NULL,
    `interes_referencial` DECIMAL(12, 2) NOT NULL,
    `saldo_referencial` DECIMAL(12, 2) NOT NULL,
    `prop_interes_anual` DECIMAL(8, 6) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `plan_cuotas_venta_id_idx`(`venta_id`),
    UNIQUE INDEX `plan_cuotas_venta_id_num_cuota_key`(`venta_id`, `num_cuota`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `plan_cuotas` ADD CONSTRAINT `plan_cuotas_empresa_id_fkey` FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_cuotas` ADD CONSTRAINT `plan_cuotas_venta_id_fkey` FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
