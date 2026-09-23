import { Router } from 'express';
import QRCode from 'qrcode';
import { getStatus, getQR, logout, restart, resetSession, startConnection } from '../whatsapp.js';

const router = Router();

router.get('/status', (req, res) => {
  res.json(getStatus());
});

router.get('/qr', async (req, res) => {
  const qr = getQR();
  if (!qr) {
    return res.status(404).json({ message: 'QR code belum tersedia.' });
  }
  try {
    const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    res.json({ qr: dataUrl });
  } catch (err) {
    res.status(500).json({ message: 'Gagal membuat QR code.' });
  }
});

router.post('/logout', async (req, res) => {
  await logout();
  res.json({ message: 'WhatsApp berhasil diputuskan.' });
});

router.post('/restart', async (req, res) => {
  await restart();
  res.json({ message: 'WhatsApp sedang dihubungkan ulang.' });
});

router.post('/reset', async (req, res) => {
  await resetSession();
  res.json({ message: 'Sesi WhatsApp direset. Silakan scan QR code baru.' });
});

router.post('/connect', async (req, res) => {
  const status = getStatus();
  if (status.status === 'connected') {
    return res.json({ message: 'WhatsApp sudah terhubung.' });
  }
  await startConnection();
  res.json({ message: 'Proses koneksi dimulai. Silakan scan QR code.' });
});

export default router;
