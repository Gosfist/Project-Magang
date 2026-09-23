import { Router } from 'express';
import { getWaLogs, clearWaLogs, deleteWaLog } from '../db.js';

const router = Router();

// GET /api/wa/logs
router.get('/logs', async (req, res) => {
  const { limit = 100, search = '' } = req.query;
  try {
    const logs = await getWaLogs({ limit, search });
    res.json({
      logs: logs.map((l) => ({
        id: Number(l.id),
        target: l.target,
        text: l.text,
        status: l.status,
        errorMessage: l.error_message,
        createdAt: l.created_at,
      })),
      total: logs.length,
    });
  } catch (err) {
    console.error('[Logs GET Error]:', err.message);
    res.status(500).json({ message: 'Gagal mengambil log: ' + err.message, logs: [] });
  }
});

// DELETE /api/wa/logs - Clear all logs
router.delete('/logs', async (req, res) => {
  try {
    await clearWaLogs();
    res.json({ message: 'Semua log notifikasi berhasil dibersihkan.' });
  } catch (err) {
    console.error('[Logs DELETE Error]:', err.message);
    res.status(500).json({ message: 'Gagal menghapus log: ' + err.message });
  }
});

// DELETE /api/wa/logs/:id - Delete single log
router.delete('/logs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await deleteWaLog(id);
    res.json({ message: 'Log berhasil dihapus.' });
  } catch (err) {
    console.error('[Logs DELETE single Error]:', err.message);
    res.status(500).json({ message: 'Gagal menghapus log: ' + err.message });
  }
});

export default router;
