-- Rename database objects while preserving existing data.
RENAME TABLE `app_settings` TO `website_settings`;

UPDATE `website_settings`
SET `key` = 'biaya_psb'
WHERE `key` = 'psb_fee';

ALTER TABLE `areas`
  RENAME COLUMN `name` TO `nama_area`,
  RENAME COLUMN `description` TO `deskripsi`;

ALTER TABLE `area_collectors`
  DROP COLUMN `is_default`;

ALTER TABLE `bot_wa_logs`
  RENAME COLUMN `recipient` TO `target`,
  RENAME COLUMN `message` TO `text`;

UPDATE `bot_wa_logs`
SET `status` = 'berhasil'
WHERE `status` IN ('success', 'berhasil');

UPDATE `bot_wa_logs`
SET `status` = 'gagal'
WHERE `status` IN ('failed', 'failure', 'gagal');
