-- Run once while backend writes are stopped. Preserve existing displayed IDs.
ALTER TABLE pppoe_accounts ADD COLUMN customer_number BIGINT UNSIGNED NULL;
UPDATE pppoe_accounts SET customer_number = id WHERE customer_number IS NULL;
ALTER TABLE pppoe_accounts
  MODIFY COLUMN customer_number BIGINT UNSIGNED NOT NULL,
  ADD UNIQUE INDEX pppoe_accounts_customer_number_key (customer_number);
