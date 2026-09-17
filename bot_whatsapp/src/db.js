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
  const [rows] = await p.execute('SELECT `value` FROM `app_settings` WHERE `key` = ?', [key]);
  return rows.length ? rows[0].value : null;
}

export async function setSetting(key, value) {
  const p = getPool();
  await p.execute(
    'INSERT INTO `app_settings` (`key`, `value`, `updated_at`) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()',
    [key, value]
  );
}

export async function getSettings(keys) {
  if (!keys.length) return new Map();
  const p = getPool();
  const placeholders = keys.map(() => '?').join(',');
  const [rows] = await p.execute(`SELECT \`key\`, \`value\` FROM \`app_settings\` WHERE \`key\` IN (${placeholders})`, keys);
  return new Map(rows.map((r) => [r.key, r.value]));
}

export default { getPool, getSetting, setSetting, getSettings };
