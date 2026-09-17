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

router.get('/templates', async (req, res) => {
  try {
    const settings = await getSettings(['wa_bot_enabled', 'wa_template_registration']);
    res.json({
      enabled: settings.get('wa_bot_enabled') === 'true',
      registration: settings.get('wa_template_registration') || DEFAULT_REGISTRATION_TEMPLATE,
    });
  } catch (err) {
    console.error('[Template GET Error]:', err.message);
    // Fallback template agar halaman tetap bisa dibuka tanpa error 500
    res.json({
      enabled: false,
      registration: DEFAULT_REGISTRATION_TEMPLATE,
      warning: 'Gagal membaca database: ' + (err.message || String(err)),
    });
  }
});

router.patch('/templates', async (req, res) => {
  const { enabled, registration } = req.body;
  try {
    if (typeof enabled === 'boolean') {
      await setSetting('wa_bot_enabled', String(enabled));
    }
    if (typeof registration === 'string' && registration.trim()) {
      await setSetting('wa_template_registration', registration.trim());
    }
    const settings = await getSettings(['wa_bot_enabled', 'wa_template_registration']);
    res.json({
      message: 'Template berhasil disimpan.',
      data: {
        enabled: settings.get('wa_bot_enabled') === 'true',
        registration: settings.get('wa_template_registration') || DEFAULT_REGISTRATION_TEMPLATE,
      },
    });
  } catch (err) {
    console.error('[Template PATCH Error]:', err.message);
    res.status(500).json({ message: 'Gagal menyimpan template: ' + (err.message || 'Koneksi database bermasalah.') });
  }
});

export default router;
