-- Migration: schools.directorEmail UNIQUE kisitini kaldir
-- Amac: Ayni mudur e-postasi ile birden fazla okul olusturulabilsin (her okul ayri sifre).
-- NOT: Bu DB'de `prisma db push` errno 121 (orders FK drift) ile basarisiz oldugu icin
--      sema degisikligi elle DDL ile uygulanir. Hem lokal hem prod (VPS) MySQL'e calistir.
--
-- Once index adini dogrula:
--   SHOW INDEX FROM schools WHERE Key_name LIKE '%directorEmail%';
-- Prisma @unique default adi: schools_directorEmail_key (Non_unique=0).
-- Normal @@index (schools_directorEmail_idx, Non_unique=1) KORUNUR.

ALTER TABLE schools DROP INDEX schools_directorEmail_key;

-- Dogrulama (sadece normal index kalmali):
--   SHOW INDEX FROM schools WHERE Key_name LIKE '%directorEmail%';
