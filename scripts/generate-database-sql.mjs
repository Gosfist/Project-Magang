import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.join(rootDir, 'backend');
const prismaDir = path.join(backendDir, 'prisma');

function normalize(text) {
  return text.replace(/\r\n/g, '\n').trim();
}

export function renderDatabaseSql(schemaSql) {
  if (!/^CREATE TABLE /m.test(schemaSql)) throw new Error('Prisma tidak menghasilkan skema tabel.');
  return `-- PT UNZANET - skema database lengkap untuk INSTALASI BARU.
-- Dihasilkan dari backend/prisma/schema.prisma: npm run database:generate
-- Pilih database MySQL KOSONG sebelum mengimpor file ini.
-- Impor sekali saat instalasi awal, bukan saat update aplikasi.
-- Akun awal dibuat terpisah dengan npm run db:seed dari folder backend.
-- Klien VPN SSTP dikelola web dan diterapkan oleh worker VPS; field WireGuard hanya legacy.

SET NAMES utf8mb4;

${normalize(schemaSql)}

-- Pengaturan awal sesuai nilai bawaan aplikasi.
INSERT INTO website_settings (\`key\`, \`value\`, updated_at) VALUES
  ('billing_start_day', '1', CURRENT_TIMESTAMP(3)),
  ('billing_end_day', '10', CURRENT_TIMESTAMP(3)),
  ('billing_timezone', 'WIB', CURRENT_TIMESTAMP(3)),
  ('isolation_check_hour', '0', CURRENT_TIMESTAMP(3));
`;
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Gunakan tanpa argumen atau --check.');
  const schemaSql = execFileSync(process.execPath, [
    path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js'),
    'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(prismaDir, 'schema.prisma'), '--script',
  ], { cwd: backendDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const sql = renderDatabaseSql(schemaSql);
  const output = path.join(prismaDir, 'database.sql');
  if (args.includes('--check')) {
    if (!existsSync(output) || normalize(readFileSync(output, 'utf8')) !== normalize(sql)) {
      throw new Error('database.sql belum sesuai skema terbaru. Jalankan npm run database:generate.');
    }
    console.log('database.sql sesuai skema Prisma terbaru. Tidak ada koneksi database.');
  } else {
    writeFileSync(output, sql, 'utf8');
    console.log('Dibuat backend/prisma/database.sql dari skema Prisma terbaru. Tidak ada koneksi database.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
