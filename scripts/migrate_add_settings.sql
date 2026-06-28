-- Migration: genel ayar deposu (settings) tablosu
-- Amac: ayarlanabilir degerler (ilk kullanim: PAYMENT_COMMISSION_RATE = "2.39").
-- NOT: Bu DB'de `prisma db push` errno 121 (orders FK drift) ile basarisiz oldugu icin
--      sema degisikligi elle DDL ile uygulanir. Hem lokal hem prod (VPS) MySQL'e calistir.

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(191) NOT NULL,
  `value` TEXT NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
);

-- Varsayilan oran (zaten varsa dokunma):
INSERT INTO settings (`key`, `value`, `updatedAt`)
VALUES ('PAYMENT_COMMISSION_RATE', '2.39', NOW(3))
ON DUPLICATE KEY UPDATE `key` = `key`;
