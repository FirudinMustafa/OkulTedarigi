-- ============================================================================
-- i18n COKLU-DIL KOLONLARI — yalnizca EKLEME (additive), tamamen NULLABLE.
-- Hicbir kolon SILINMEZ / YENIDEN ADLANDIRILMAZ / TIPI DEGISMEZ.
-- Mevcut veri (mevcut "name", "description", "note") DEGISMEZ = TR taban kabul edilir.
-- Bos dil kolonlari -> uygulama katmaninda TR'ye fallback eder (getLocalized).
--
-- prisma db push KULLANMA (FK drift errno 121). Bu DDL'i ELLE uygula:
--   Lokal:  mysql -u root okul_tedarik < scripts/migrate_i18n_columns.sql
--   Prod :  ONCE mysqldump yedegi al, sonra ayni komutu /opt/okultedarigim'de calistir.
--
-- Geri alma (gerekirse): her kolon icin ALTER TABLE ... DROP COLUMN ...;
-- ============================================================================

-- Okul adi (fiziksel adres cevrilmiyor; teslimat icin TR kalir)
ALTER TABLE `schools`
  ADD COLUMN `name_en` VARCHAR(191) NULL,
  ADD COLUMN `name_de` VARCHAR(191) NULL,
  ADD COLUMN `name_ar` VARCHAR(191) NULL;

-- Sinif adi
ALTER TABLE `classes`
  ADD COLUMN `name_en` VARCHAR(191) NULL,
  ADD COLUMN `name_de` VARCHAR(191) NULL,
  ADD COLUMN `name_ar` VARCHAR(191) NULL;

-- Paket adi + aciklama + not
ALTER TABLE `packages`
  ADD COLUMN `name_en` VARCHAR(191) NULL,
  ADD COLUMN `name_de` VARCHAR(191) NULL,
  ADD COLUMN `name_ar` VARCHAR(191) NULL,
  ADD COLUMN `description_en` TEXT NULL,
  ADD COLUMN `description_de` TEXT NULL,
  ADD COLUMN `description_ar` TEXT NULL,
  ADD COLUMN `note_en` TEXT NULL,
  ADD COLUMN `note_de` TEXT NULL,
  ADD COLUMN `note_ar` TEXT NULL;

-- Paket kalem adi
ALTER TABLE `package_items`
  ADD COLUMN `name_en` VARCHAR(191) NULL,
  ADD COLUMN `name_de` VARCHAR(191) NULL,
  ADD COLUMN `name_ar` VARCHAR(191) NULL;

-- Indirim aciklamasi
ALTER TABLE `discounts`
  ADD COLUMN `description_en` VARCHAR(191) NULL,
  ADD COLUMN `description_de` VARCHAR(191) NULL,
  ADD COLUMN `description_ar` VARCHAR(191) NULL;

-- Siparis bildirim dili (veli'nin siparis anindaki dili; e-posta/PDF bu dilde)
ALTER TABLE `orders`
  ADD COLUMN `locale` VARCHAR(5) NULL DEFAULT 'tr';
