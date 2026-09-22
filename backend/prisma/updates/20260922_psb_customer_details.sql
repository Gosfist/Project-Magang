ALTER TABLE psb_orders
  ADD COLUMN id_card_number VARCHAR(50) NULL AFTER phone,
  ADD COLUMN id_card_photo LONGTEXT NULL AFTER id_card_number,
  ADD COLUMN latitude DOUBLE NULL AFTER address,
  ADD COLUMN longitude DOUBLE NULL AFTER latitude;

ALTER TABLE pppoe_accounts MODIFY COLUMN id_card_photo LONGTEXT NULL;
