import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDatabaseUrl() {
  let dbUrl = process.env.DATABASE_URL;

  // Fallback ke backend/.env jika kosong atau memakai root tanpa password
  const backendEnv = join(__dirname, '..', '..', 'backend', '.env');
  if (existsSync(backendEnv)) {
    try {
      const content = readFileSync(backendEnv, 'utf8');
      const match = content.match(/^DATABASE_URL=["']?(.*?)["']?$/m);
      if (match && match[1]) {
        if (!dbUrl || (dbUrl.includes('root:@') && !match[1].includes('root:@'))) {
          dbUrl = match[1];
        }
      }
    } catch (_) {}
  }

  return (dbUrl || 'mysql://root:@127.0.0.1:3306/unzanet').replace(/^["']|["']$/g, '').trim();
}

function parsePoolConfig() {
  const rawUrl = resolveDatabaseUrl();
  try {
    const cleanUrl = rawUrl.replace(/^mysql:\/\//, 'http://');
    const parsed = new URL(cleanUrl);
    return {
      host: parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname,
      port: Number(parsed.port) || 3306,
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: (parsed.pathname ? parsed.pathname.slice(1) : 'unzanet').split('?')[0],
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 10000,
    };
  } catch (err) {
    console.error('[DB] Error parsing DATABASE_URL:', err.message);
    return {
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: 'unzanet',
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 10000,
    };
  }
}

let pool = null;
export function getPool() {
  if (!pool) {
    pool = mysql.createPool(parsePoolConfig());
  }
  return pool;
}

export async function getSetting(key) {
  const p = getPool();
  const [rows] = await p.execute('SELECT `value` FROM `website_settings` WHERE `key` = ?', [key]);
  return rows.length ? rows[0].value : null;
}

export async function setSetting(key, value) {
  const p = getPool();
  await p.execute(
    'INSERT INTO `website_settings` (`key`, `value`, `updated_at`) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()',
    [key, value]
  );
}

export async function getSettings(keys) {
  if (!keys.length) return new Map();
  const p = getPool();
  const placeholders = keys.map(() => '?').join(',');
  const [rows] = await p.execute(`SELECT \`key\`, \`value\` FROM \`website_settings\` WHERE \`key\` IN (${placeholders})`, keys);
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function ensureLogsTable() {
  try {
    const p = getPool();
    await p.execute(`
      CREATE TABLE IF NOT EXISTS \`bot_wa_logs\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`target\` VARCHAR(50) NOT NULL,
        \`text\` TEXT NOT NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'berhasil',
        \`error_message\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_bot_wa_logs_created_at\` (\`created_at\`),
        INDEX \`idx_bot_wa_logs_target\` (\`target\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (err) {
    console.warn('[DB] Could not ensure bot_wa_logs table:', err.message);
  }
}

export async function insertWaLog({ target, text, status = 'berhasil', errorMessage = null }) {
  try {
    await ensureLogsTable();
    const p = getPool();
    await p.execute(
      'INSERT INTO `bot_wa_logs` (`target`, `text`, `status`, `error_message`, `created_at`) VALUES (?, ?, ?, ?, NOW())',
      [target, text, status, errorMessage]
    );
  } catch (err) {
    console.error('[DB] Failed to insert WA log:', err.message);
  }
}

export async function getWaLogs({ limit = 100, search = '' } = {}) {
  try {
    await ensureLogsTable();
    const p = getPool();
    const safeLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 100));
    let sql = 'SELECT `id`, `target`, `text`, `status`, `error_message`, `created_at` FROM `bot_wa_logs`';
    const params = [];
    if (search && search.trim()) {
      sql += ' WHERE `target` LIKE ? OR `text` LIKE ?';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }
    sql += ` ORDER BY \`created_at\` DESC LIMIT ${safeLimit}`;

    const [rows] = await p.execute(sql, params);
    return rows;
  } catch (err) {
    console.error('[DB] Failed to get WA logs:', err.message);
    return [];
  }
}

export async function clearWaLogs() {
  try {
    await ensureLogsTable();
    const p = getPool();
    await p.execute('TRUNCATE TABLE `bot_wa_logs`');
    return true;
  } catch (err) {
    console.error('[DB] Failed to clear WA logs:', err.message);
    throw err;
  }
}

export async function deleteWaLog(id) {
  try {
    await ensureLogsTable();
    const p = getPool();
    await p.execute('DELETE FROM `bot_wa_logs` WHERE `id` = ?', [id]);
    return true;
  } catch (err) {
    console.error('[DB] Failed to delete WA log:', err.message);
    throw err;
  }
}

export default {
  getPool,
  getSetting,
  setSetting,
  getSettings,
  ensureLogsTable,
  insertWaLog,
  getWaLogs,
  clearWaLogs,
  deleteWaLog,
};
