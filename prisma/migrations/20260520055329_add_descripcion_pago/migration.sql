/*
  Warnings:

  - You are about to drop the column `comentario` on the `pagos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `pagos` DROP COLUMN `comentario`,
    ADD COLUMN `descripcion` VARCHAR(500) NULL;
