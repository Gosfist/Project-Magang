import { Router } from 'express';
import { getSetting, setSetting, getSettings } from '../db.js';

const router = Router();

const DEFAULT_REGISTRATION_TEMPLATE = `Halo {nama}! 👋

Selamat, akun internet Anda telah berhasil didaftarkan di PT Unzanet.

📋 *Detail Akun:*
• Nomor Pelanggan: {nomor_pelanggan}
• Paket: {paket}
• Username PPPoE: {username}
• Password PPPoE: {password}

Terima kasih telah memilih layanan kami! Jika ada pertanyaan, silakan hubungi tim support kami.

— PT Unzanet`;

const DEFAULT_ISOLATION_TEMPLATE = `Halo {nama}! ⚠️

Kami informasikan bahwa layanan internet Anda (No. Pelanggan: {nomor_pelanggan}) sementara kami nonaktifkan (isolir) dikarenakan tagihan belum diselesaikan.

📋 *Detail Tagihan:*
• Paket: {paket}
• Total Tagihan: {total_tagihan}
• Batas Pembayaran: {jatuh_tempo}

Mohon segera melakukan pembayaran agar layanan internet Anda dapat aktif kembali secara otomatis.

Abaikan pesan ini jika Anda sudah melakukan pembayaran. Terima kasih.

— PT Unzanet`;

const DEFAULT_DEPOSIT_COLLECTOR_TEMPLATE = `Halo {nama}! 📝

Kami informasikan bahwa tagihan Anda telah disetor ke kolektor kami.

📋 *Detail Setoran:*
• Nomor Pelanggan: {nomor_pelanggan}
• Jumlah: {jumlah}
• Tanggal Setor: {tanggal_setor}
• Kolektor: {nama_kolektor}
• Area: {area}

Setoran Anda sedang diverifikasi oleh tim kami. Anda akan menerima notifikasi setelah pembayaran dikonfirmasi.

— PT Unzanet`;

const DEFAULT_DEPOSIT_ACCEPTED_TEMPLATE = `Halo {nama}! ✅

Pembayaran tagihan Anda telah berhasil diterima dan dikonfirmasi oleh perusahaan.

📋 *Detail Pembayaran:*
• Nomor Pelanggan: {nomor_pelanggan}
• Jumlah: {jumlah}
• Bulan Tagihan: {bulan_tagihan}
• Diterima Pada: {tanggal_diterima}

Terima kasih atas pembayaran Anda! Layanan internet Anda tetap aktif.

— PT Unzanet`;

router.get('/templates', async (req, res) => {
  try {
    const settings = await getSettings(['wa_bot_enabled', 'wa_template_registration', 'wa_template_isolation', 'wa_template_deposit_collector', 'wa_template_deposit_accepted']);
    res.json({
      enabled: settings.get('wa_bot_enabled') === 'true',
      registration: settings.get('wa_template_registration') || DEFAULT_REGISTRATION_TEMPLATE,
      isolation: settings.get('wa_template_isolation') || DEFAULT_ISOLATION_TEMPLATE,
      deposit_collector: settings.get('wa_template_deposit_collector') || DEFAULT_DEPOSIT_COLLECTOR_TEMPLATE,
      deposit_accepted: settings.get('wa_template_deposit_accepted') || DEFAULT_DEPOSIT_ACCEPTED_TEMPLATE,
    });
  } catch (err) {
    console.error('[Template GET Error]:', err.message);
    // Fallback template agar halaman tetap bisa dibuka tanpa error 500
    res.json({
      enabled: false,
      registration: DEFAULT_REGISTRATION_TEMPLATE,
      isolation: DEFAULT_ISOLATION_TEMPLATE,
      deposit_collector: DEFAULT_DEPOSIT_COLLECTOR_TEMPLATE,
      deposit_accepted: DEFAULT_DEPOSIT_ACCEPTED_TEMPLATE,
      warning: 'Gagal membaca database: ' + (err.message || String(err)),
    });
  }
});

router.patch('/templates', async (req, res) => {
  const { enabled, registration, isolation, deposit_collector, deposit_accepted, ...otherTemplates } = req.body;
  try {
    if (typeof enabled === 'boolean') {
      await setSetting('wa_bot_enabled', String(enabled));
    }
    if (typeof registration === 'string' && registration.trim()) {
      await setSetting('wa_template_registration', registration.trim());
    }
    if (typeof isolation === 'string' && isolation.trim()) {
      await setSetting('wa_template_isolation', isolation.trim());
    }
    if (typeof deposit_collector === 'string' && deposit_collector.trim()) {
      await setSetting('wa_template_deposit_collector', deposit_collector.trim());
    }
    if (typeof deposit_accepted === 'string' && deposit_accepted.trim()) {
      await setSetting('wa_template_deposit_accepted', deposit_accepted.trim());
    }
    for (const [key, val] of Object.entries(otherTemplates)) {
      if (typeof val === 'string' && val.trim()) {
        await setSetting(`wa_template_${key}`, val.trim());
      }
    }

    const settings = await getSettings(['wa_bot_enabled', 'wa_template_registration', 'wa_template_isolation', 'wa_template_deposit_collector', 'wa_template_deposit_accepted']);
    res.json({
      message: 'Template berhasil disimpan.',
      data: {
        enabled: settings.get('wa_bot_enabled') === 'true',
        registration: settings.get('wa_template_registration') || DEFAULT_REGISTRATION_TEMPLATE,
        isolation: settings.get('wa_template_isolation') || DEFAULT_ISOLATION_TEMPLATE,
        deposit_collector: settings.get('wa_template_deposit_collector') || DEFAULT_DEPOSIT_COLLECTOR_TEMPLATE,
        deposit_accepted: settings.get('wa_template_deposit_accepted') || DEFAULT_DEPOSIT_ACCEPTED_TEMPLATE,
      },
    });
  } catch (err) {
    console.error('[Template PATCH Error]:', err.message);
    res.status(500).json({ message: 'Gagal menyimpan template: ' + (err.message || 'Koneksi database bermasalah.') });
  }
});

export default router;

