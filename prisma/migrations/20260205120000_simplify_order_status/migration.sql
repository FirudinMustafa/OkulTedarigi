-- Siparis durumlarini 11'den 6'ya dusur

-- 1. Enum'u genislet: hem eski hem yeni degerleri icersin
ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('NEW', 'PAYMENT_PENDING', 'PAYMENT_RECEIVED', 'CONFIRMED', 'INVOICED', 'CARGO_SHIPPED', 'DELIVERED_TO_SCHOOL', 'DELIVERED_BY_CARGO', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED') NOT NULL DEFAULT 'PAID';

-- 2. Mevcut siparislerin durumlarini yeni degerlere map'le
UPDATE `orders` SET `status` = 'PAID' WHERE `status` IN ('NEW', 'PAYMENT_PENDING', 'PAYMENT_RECEIVED', 'CONFIRMED');
UPDATE `orders` SET `status` = 'PREPARING' WHERE `status` = 'INVOICED';
UPDATE `orders` SET `status` = 'SHIPPED' WHERE `status` = 'CARGO_SHIPPED';
UPDATE `orders` SET `status` = 'DELIVERED' WHERE `status` IN ('DELIVERED_TO_SCHOOL', 'DELIVERED_BY_CARGO');
-- COMPLETED kaldigi gibi kalir
UPDATE `orders` SET `status` = 'CANCELLED' WHERE `status` = 'REFUNDED';

-- 3. Enum'u daralt: sadece yeni degerleri birak
ALTER TABLE `orders` MODIFY COLUMN `status` ENUM('PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PAID';
