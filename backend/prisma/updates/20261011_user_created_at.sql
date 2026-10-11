-- Preserve existing creation timestamps; infer only missing legacy dates.
SET @ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'created_at'), 'SELECT 1', 'ALTER TABLE users ADD COLUMN created_at DATETIME(3) NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
UPDATE users u LEFT JOIN (SELECT sales_user_id, MIN(created_at) AS first_input FROM psb_orders GROUP BY sales_user_id) p ON p.sales_user_id = u.id
SET u.created_at = COALESCE(p.first_input, UTC_TIMESTAMP(3)) WHERE u.created_at IS NULL;
ALTER TABLE users MODIFY created_at DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3);
