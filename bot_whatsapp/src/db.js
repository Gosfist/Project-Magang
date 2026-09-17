import mysql from 'mysql2/promise';

const url = new URL(process.env.DATABASE_URL.replace(/^mysql:\/\//, 'http://'));
const pool = mysql.createPool({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  waitForConnections: true,
  connectionLimit: 5,
});

export async function getSetting(key) {
  const [rows] = await pool.execute('SELECT `value` FROM `app_settings` WHERE `key` = ?', [key]);
  return rows.length ? rows[0].value : null;
}

export async function setSetting(key, value) {
  await pool.execute(
    'INSERT INTO `app_settings` (`key`, `value`, `updated_at`) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`), `updated_at` = NOW()',
    [key, value]
  );
}

export async function getSettings(keys) {
  if (!keys.length) return new Map();
  const placeholders = keys.map(() => '?').join(',');
  const [rows] = await pool.execute(`SELECT \`key\`, \`value\` FROM \`app_settings\` WHERE \`key\` IN (${placeholders})`, keys);
  return new Map(rows.map((r) => [r.key, r.value]));
}

export default pool;
