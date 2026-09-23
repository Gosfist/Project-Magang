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
let connectedAt = null;
let botNumber = null;
let reconnectTimer = null;
let connectionToken = 0;

export function getStatus() {
  const uptimeSeconds = (status === 'connected' && connectedAt)
    ? Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
    : 0;

  return {
    status,
    qrAvailable: !!qrCode,
    message: statusMessage,
    botNumber,
    connectedAt,
    uptime: uptimeSeconds,
  };
}

export function getQR() {
  return qrCode;
}

function stopReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(token) {
  stopReconnect();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (token === connectionToken && status === 'disconnected') {
      void startConnection();
    }
  }, 3000);
}

export async function startConnection() {
  if (status === 'connected' || status === 'connecting') return;
  stopReconnect();
  const token = ++connectionToken;
  status = 'connecting';
  statusMessage = 'Menghubungkan ke WhatsApp...';
  qrCode = null;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    if (state?.creds?.me?.id) {
      botNumber = state.creds.me.id.split(':')[0].split('@')[0];
    }
    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: true,
      logger,
      browser: ['Unzanet Bot', 'Chrome', '1.0.0'],
    });
    const activeSocket = sock;

    sock.ev.on('connection.update', (update) => {
      if (token !== connectionToken || activeSocket !== sock) return;
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        qrCode = qr;
        status = 'qr_ready';
        statusMessage = '';
      }
      if (connection === 'close') {
        sock = null;
        qrCode = null;
        connectedAt = null;
        const reason = lastDisconnect?.error
          ? new Boom(lastDisconnect.error).output?.statusCode
          : undefined;
        if (reason === DisconnectReason.loggedOut) {
          status = 'disconnected';
          statusMessage = 'Sesi WhatsApp telah keluar. Silakan hubungkan ulang.';
          botNumber = null;
          clearAuth();
        } else {
          status = 'disconnected';
          statusMessage = 'Koneksi terputus. Mencoba menghubungkan ulang...';
          scheduleReconnect(token);
        }
      } else if (connection === 'open') {
        qrCode = null;
        status = 'connected';
        statusMessage = '';
        if (!connectedAt) {
          connectedAt = Date.now();
        }
        const rawId = sock?.user?.id || state?.creds?.me?.id || '';
        if (rawId) {
          botNumber = rawId.split(':')[0].split('@')[0];
        }
        console.log('[WA] Connected successfully as', botNumber);
      }
    });

    sock.ev.on('creds.update', () => {
      if (token === connectionToken) void saveCreds();
    });
  } catch (err) {
    if (token !== connectionToken) return;
    status = 'disconnected';
    statusMessage = `Gagal menghubungkan: ${err.message}`;
    console.error('[WA] Connection error:', err.message);
    scheduleReconnect(token);
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

async function closeSocket(logout = false) {
  stopReconnect();
  connectionToken += 1;
  const activeSocket = sock;
  sock = null;
  if (!activeSocket) return;
  if (logout) {
    try { await activeSocket.logout(); } catch (_) {}
  }
  try { activeSocket.end(); } catch (_) {}
}

export async function logout() {
  await closeSocket(true);
  qrCode = null;
  connectedAt = null;
  botNumber = null;
  status = 'disconnected';
  statusMessage = 'WhatsApp telah diputuskan.';
  clearAuth();
}

export async function restart() {
  await closeSocket();
  qrCode = null;
  connectedAt = null;
  botNumber = null;
  status = 'disconnected';
  statusMessage = '';
  await startConnection();
}

export async function resetSession() {
  await closeSocket();
  clearAuth();
  qrCode = null;
  connectedAt = null;
  botNumber = null;
  status = 'disconnected';
  statusMessage = '';
  await startConnection();
}

function clearAuth() {
  try {
    if (existsSync(AUTH_DIR)) rmSync(AUTH_DIR, { recursive: true, force: true });
  } catch (_) {}
}
