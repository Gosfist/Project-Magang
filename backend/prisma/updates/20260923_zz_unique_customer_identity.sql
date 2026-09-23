-- Existing duplicates must be resolved before applying these constraints.
-- No customer data is deleted by this migration.
ALTER TABLE `daftar_pelanggan`
  ADD UNIQUE INDEX `daftar_pelanggan_id_card_number_key` (`id_card_number`),
  ADD UNIQUE INDEX `daftar_pelanggan_phone_key` (`phone`);

ALTER TABLE `psb_orders`
  ADD UNIQUE INDEX `psb_orders_id_card_number_key` (`id_card_number`),
  ADD UNIQUE INDEX `psb_orders_phone_key` (`phone`);
