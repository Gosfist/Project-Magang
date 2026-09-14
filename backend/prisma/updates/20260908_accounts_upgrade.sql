ALTER TABLE pppoe_accounts
  ADD COLUMN id_card_number VARCHAR(50) DEFAULT NULL,
  ADD COLUMN id_card_photo VARCHAR(500) DEFAULT NULL,
  ADD COLUMN latitude DOUBLE DEFAULT NULL,
  ADD COLUMN longitude DOUBLE DEFAULT NULL,
  ADD COLUMN subscription_type VARCHAR(10) NOT NULL DEFAULT 'POSTPAID',
  ADD COLUMN billing_day INT UNSIGNED NOT NULL DEFAULT 1,
  ADD COLUMN discount BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN odp VARCHAR(100) DEFAULT NULL,
  ADD COLUMN router_nas_id INT UNSIGNED DEFAULT NULL,
  ADD CONSTRAINT fk_accounts_router_nas FOREIGN KEY (router_nas_id) REFERENCES nas(id) ON DELETE SET NULL;
CREATE INDEX idx_accounts_subscription ON pppoe_accounts(subscription_type);
CREATE INDEX idx_accounts_billing_day ON pppoe_accounts(billing_day);
CREATE INDEX idx_accounts_router_nas ON pppoe_accounts(router_nas_id);
