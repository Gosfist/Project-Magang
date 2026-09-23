-- Registrasi yang sudah diaktivasi/selesai wajib memiliki akun PPPoE.
-- Data PROCESS tidak dihapus karena masih merupakan antrean pemasangan yang valid.
DELETE FROM psb_orders
WHERE pppoe_account_id IS NULL
  AND status IN ('ACTIVATED', 'COMPLETED');
