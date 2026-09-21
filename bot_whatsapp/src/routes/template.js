import { Router } from 'express';
import { getSettings, setSetting } from '../db.js';

const router = Router();
const DEFAULTS = {
  sales: `Halo Bapak/Ibu {nama},\n\nProses registrasi pelanggan baru telah berhasil. Mohon bersabar, teknisi kami akan melakukan kunjungan.\n\nNo. Pelanggan: {nomor_pelanggan}\nNama: {nama}\nNomor WA: {nomor_wa}\nAlamat: {alamat}\nLayanan: {layanan}\n\n— PT Unzanet`,
  psb: `Halo Bapak/Ibu {nama},\n\nInternet Anda telah aktif.\n\nNo. Pelanggan: {nomor_pelanggan}\nLayanan: {layanan}\nBiaya PSB: {biaya_psb}\nPembayaran berikutnya tanggal {tanggal_mulai}-{tanggal_akhir} setiap bulan. Jika melewati jatuh tempo, layanan dapat diisolir.\n\n— PT Unzanet`,
  registration: `Halo {nama}, akun internet Anda telah didaftarkan.\nNo. Pelanggan: {nomor_pelanggan}\nPaket: {paket}\nUsername: {username}\nPassword: {password}\n\n— PT Unzanet`,
  isolation: `Halo {nama}, layanan internet No. {nomor_pelanggan} diisolir karena tagihan belum diselesaikan.\nPaket: {paket}\nTotal: {total_tagihan}\nJatuh tempo: {jatuh_tempo}\n\n— PT Unzanet`,
  deposit_collector: `Halo {nama}, pembayaran {jumlah} untuk No. {nomor_pelanggan} telah diterima kolektor {nama_kolektor} pada {tanggal_setor}. Statusnya sedang diverifikasi.\n\n— PT Unzanet`,
  deposit_accepted: `Halo {nama}, pembayaran {jumlah} untuk tagihan {bulan_tagihan} telah diterima perusahaan pada {tanggal_diterima}.\n\n— PT Unzanet`,
};
const templateKeys = Object.keys(DEFAULTS);
const dbKeys = ['wa_bot_enabled', ...templateKeys.map(key => `wa_template_${key}`)];
const response = settings => Object.fromEntries([
  ['enabled', settings.get('wa_bot_enabled') === 'true'],
  ...templateKeys.map(key => [key, settings.get(`wa_template_${key}`) || DEFAULTS[key]]),
]);

router.get('/templates', async (_req, res) => {
  try { res.json(response(await getSettings(dbKeys))); }
  catch (error) { res.json({ enabled: false, ...DEFAULTS, warning: `Gagal membaca database: ${error.message || String(error)}` }); }
});

router.patch('/templates', async (req, res) => {
  try {
    if (typeof req.body.enabled === 'boolean') await setSetting('wa_bot_enabled', String(req.body.enabled));
    for (const key of templateKeys) {
      const value = req.body[key];
      if (typeof value === 'string' && value.trim()) await setSetting(`wa_template_${key}`, value.trim());
    }
    res.json({ message: 'Template berhasil disimpan.', data: response(await getSettings(dbKeys)) });
  } catch (error) { res.status(500).json({ message: `Gagal menyimpan template: ${error.message || 'Koneksi database bermasalah.'}` }); }
});

export default router;
