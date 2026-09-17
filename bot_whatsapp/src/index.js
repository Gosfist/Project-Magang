import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import statusRoutes from './routes/status.js';
import sendRoutes from './routes/send.js';
import templateRoutes from './routes/template.js';
import logsRoutes from './routes/logs.js';
import { ensureLogsTable } from './db.js';
import { startConnection } from './whatsapp.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/wa', statusRoutes);
app.use('/api/wa', sendRoutes);
app.use('/api/wa', templateRoutes);
app.use('/api/wa', logsRoutes);

// Health check
app.get('/api/wa/health', (req, res) => {
  res.json({ status: 'ok', service: 'bot-whatsapp' });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Bot WA] Server running on port ${PORT}`);
  ensureLogsTable().catch((err) => {
    console.warn('[Bot WA] Table init warning:', err.message);
  });
  // Auto-connect if auth info exists
  startConnection().catch((err) => {
    console.error('[Bot WA] Auto-connect failed:', err.message);
  });
});
