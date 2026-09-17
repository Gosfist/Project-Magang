import { Router } from 'express';
import { sendMessage } from '../whatsapp.js';
import { apiKeyAuth } from '../middleware/auth.js';

const router = Router();

// Protected by API key - only backend can call this
router.post('/send', apiKeyAuth, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ message: 'Nomor telepon dan pesan wajib diisi.' });
  }
  try {
    const result = await sendMessage(phone, message);
    res.json({ message: 'Pesan berhasil dikirim.', ...result });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Gagal mengirim pesan.' });
  }
});

export default router;
