ALTER TABLE psb_orders
  ADD COLUMN installation_fee_paid BIGINT UNSIGNED NULL AFTER completed_at;
