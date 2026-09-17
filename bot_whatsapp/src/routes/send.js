import { Router } from 'express';
import { sendMessage, getStatus } from '../whatsapp.js';
import { apiKeyAuth } from '../middleware/auth.js';
import { insertWaLog } from '../db.js';

const router = Router();

// Endpoint test ping dari frontend
router.post('/ping', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ message: 'Nomor target wajib diisi.' });
  }

  const currentStatus = getStatus();
  if (currentStatus.status !== 'connected') {
    return res.status(400).json({ message: 'WhatsApp belum terhubung. Silakan hubungkan WhatsApp terlebih dahulu.' });
  }

  const timeStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());

  const testMessage = `*Ping!*\nKoneksi Bot WhatsApp aktif dan berjalan normal.\nWaktu: ${timeStr}`;

  try {
    const result = await sendMessage(phone, testMessage);
    await insertWaLog({ recipient: phone, message: testMessage, status: 'success' });
    res.json({ message: `Pesan Ping berhasil dikirim ke ${phone}.`, ...result });
  } catch (err) {
    await insertWaLog({ recipient: phone, message: testMessage, status: 'failed', errorMessage: err.message });
    res.status(500).json({ message: err.message || 'Gagal mengirim pesan Ping.' });
  }
});

// Protected by API key - only backend can call this
router.post('/send', apiKeyAuth, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ message: 'Nomor telepon dan pesan wajib diisi.' });
  }
  try {
    const result = await sendMessage(phone, message);
    await insertWaLog({ recipient: phone, message, status: 'success' });
    res.json({ message: 'Pesan berhasil dikirim.', ...result });
  } catch (err) {
    await insertWaLog({ recipient: phone, message, status: 'failed', errorMessage: err.message });
    res.status(500).json({ message: err.message || 'Gagal mengirim pesan.' });
  }
});

export default router;
