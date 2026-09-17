-- Menyimpan jenis biaya tambahan pelanggan: bulanan atau sekali bayar.
ALTER TABLE `customer_addons`
  ADD COLUMN `fee_type` VARCHAR(15) NOT NULL DEFAULT 'ONCE' AFTER `amount`;
