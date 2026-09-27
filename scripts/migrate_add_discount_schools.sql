-- Discount <-> School okul bazli kisitlama icin join tablosu.
-- `prisma db push` prod DB'de FK drift nedeniyle basarisiz oluyor (bkz. CLAUDE.md/deploy notlari),
-- bu yuzden elle uygulanir (VPS + local MySQL).
CREATE TABLE IF NOT EXISTS `discount_schools` (
  `id` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `discountId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `schoolId` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `discount_schools_discountId_schoolId_key` (`discountId`,`schoolId`),
  KEY `discount_schools_schoolId_idx` (`schoolId`),
  CONSTRAINT `discount_schools_discountId_fkey` FOREIGN KEY (`discountId`) REFERENCES `discounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `discount_schools_schoolId_fkey` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
