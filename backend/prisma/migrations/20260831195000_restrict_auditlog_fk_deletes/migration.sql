-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_userId_fkey`;

-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_invoiceId_fkey`;

-- AddForeignKey
-- Changed from ON DELETE SET NULL to ON DELETE RESTRICT: AuditLog rows hash-chain
-- over their userId/invoiceId, so a cascading SET NULL on deletion of the referenced
-- row would silently corrupt an already-written audit entry's integrity hash.
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
