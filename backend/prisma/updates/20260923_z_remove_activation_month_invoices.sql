-- Remove only unpaid scheduler invoices incorrectly charged in the activation month.
-- Preserve invoices with collection/payment evidence. Do not reactivate accounts here.
DELETE i FROM invoices i
JOIN daftar_pelanggan a ON a.id = i.pppoe_account_id
WHERE i.status = 'PENDING' AND i.invoice_type = 'MONTHLY'
  AND i.invoice_number LIKE 'INV-%'
  AND i.notes LIKE 'Tagihan bulanan %'
  AND DATE_FORMAT(i.due_date, '%Y-%m') = DATE_FORMAT(
    DATE_ADD(a.created_at, INTERVAL (
      SELECT CASE value WHEN 'WITA' THEN 8 WHEN 'WIT' THEN 9 ELSE 7 END
      FROM website_settings WHERE `key` = 'billing_timezone'
    ) HOUR), '%Y-%m')
  AND NOT EXISTS (SELECT 1 FROM collector_deposits d WHERE d.invoice_id = i.id);
