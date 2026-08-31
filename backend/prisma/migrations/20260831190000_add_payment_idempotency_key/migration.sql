-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `idempotencyKey` VARCHAR(191) NULL,
    ADD COLUMN `provider` VARCHAR(191) NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE UNIQUE INDEX `Payment_idempotencyKey_key` ON `Payment`(`idempotencyKey`);
