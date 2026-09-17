import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = join(__dirname, '..', 'auth_info');
const logger = pino({ level: 'silent' });

let sock = null;
let qrCode = null;
let status = 'disconnected'; // disconnected | connecting | qr_ready | connected
let statusMessage = '';

export function getStatus() {
  return { status, qrAvailable: !!qrCode, message: statusMessage };
}

export function getQR() {
  return qrCode;
}

export async function startConnection() {
  if (status === 'connected' || status === 'connecting') return;
  status = 'connecting';
  statusMessage = 'Menghubungkan ke WhatsApp...';
  qrCode = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: true,
      logger,
      browser: ['Unzanet Bot', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        qrCode = qr;
        status = 'qr_ready';
        statusMessage = '';
      }
      if (connection === 'close') {
        qrCode = null;
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut) {
          status = 'disconnected';
          statusMessage = 'Sesi WhatsApp telah keluar. Silakan hubungkan ulang.';
          clearAuth();
        } else {
          status = 'disconnected';
          statusMessage = 'Koneksi terputus. Mencoba menghubungkan ulang...';
          setTimeout(() => startConnection(), 3000);
        }
      } else if (connection === 'open') {
        qrCode = null;
        status = 'connected';
        statusMessage = 'WhatsApp terhubung.';
        console.log('[WA] Connected successfully');
      }
    });

    sock.ev.on('creds.update', saveCreds);
  } catch (err) {
    status = 'disconnected';
    statusMessage = `Gagal menghubungkan: ${err.message}`;
    console.error('[WA] Connection error:', err.message);
  }
}

export async function sendMessage(phone, text) {
  if (status !== 'connected' || !sock) {
    throw new Error('WhatsApp belum terhubung.');
  }
  // Normalize phone: remove leading 0, add 62 prefix if needed
  let jid = phone.replace(/[^\d]/g, '');
  if (jid.startsWith('0')) jid = '62' + jid.slice(1);
  if (!jid.startsWith('62')) jid = '62' + jid;
  jid = jid + '@s.whatsapp.net';

  await sock.sendMessage(jid, { text });
  return { success: true, jid };
}

export async function logout() {
  if (sock) {
    try { await sock.logout(); } catch (_) {}
    try { sock.end(); } catch (_) {}
    sock = null;
  }
  qrCode = null;
  status = 'disconnected';
  statusMessage = 'WhatsApp telah diputuskan.';
  clearAuth();
}

export async function restart() {
  if (sock) {
    try { sock.end(); } catch (_) {}
    sock = null;
  }
  qrCode = null;
  status = 'disconnected';
  statusMessage = '';
  await startConnection();
}

function clearAuth() {
  try {
    if (existsSync(AUTH_DIR)) rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch (_) {}
}
