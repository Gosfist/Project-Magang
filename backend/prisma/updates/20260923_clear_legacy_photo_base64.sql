UPDATE daftar_pelanggan SET id_card_photo = NULL WHERE id_card_photo IS NOT NULL;
UPDATE psb_orders SET id_card_photo = NULL, installation_photo = NULL WHERE id_card_photo IS NOT NULL OR installation_photo IS NOT NULL;
UPDATE collector_deposits SET receipt_photo = NULL WHERE receipt_photo IS NOT NULL;
UPDATE users SET photo = NULL WHERE photo IS NOT NULL;
