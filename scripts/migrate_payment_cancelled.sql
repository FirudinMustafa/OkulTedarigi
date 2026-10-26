-- Hakedis odemesi iptali: hatali/mukerrer kayit silinmez, gerekceyle CANCELLED yapilir.
-- (prisma db push FK drift yuzunden kullanilmiyor — elle uygula, lokal + prod)
ALTER TABLE school_payments
  MODIFY status ENUM('PENDING','PAID','CANCELLED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN cancelledAt DATETIME(3) NULL,
  ADD COLUMN cancelReason TEXT NULL;
