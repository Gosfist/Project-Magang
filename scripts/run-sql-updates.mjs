import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');
const updatesDir = path.join(backendDir, 'prisma', 'updates');

const { PrismaClient } = await import(pathToFileURL(path.join(backendDir, 'node_modules', '@prisma', 'client', 'default.js')));
const prisma = new PrismaClient();

const features = new Map([
  ['20260908_activity_logs.sql', 'Log aktivitas admin'],
  ['20260908_add_user_phone.sql', 'Nomor HP petugas'],
  ['20260908_ip_pools.sql', 'IP Pool PPPoE'],
  ['20260908_invoices.sql', 'Invoice pelanggan'],
  ['20260908_monitoring_errors.sql', 'Monitoring error log'],
  ['20260908_router_wireguard.sql', 'Router, NAS, dan WireGuard'],
  ['20260908_packages_upgrade.sql', 'Upgrade paket PPPoE'],
  ['20260908_accounts_upgrade.sql', 'Upgrade akun PPPoE dan data pelanggan'],
  ['20260917_customer_number.sql', 'ID pelanggan 6 digit'],
  ['20260917_customer_services.sql', 'Invoice, add-ons, janji bayar, dan log autentikasi'],
  ['20260917_monitoring_stats.sql', 'Grafik monitoring server dan router'],
]);

function checksum(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function scalar(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  const first = rows?.[0] ?? {};
  return Number(Object.values(first)[0] ?? 0);
}

async function tableExists(table) {
  return (await scalar(`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = '${table}'
  `)) > 0;
}

async function columnExists(table, column) {
  return (await scalar(`
    SELECT COUNT(*) AS count
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = '${table}' AND column_name = '${column}'
  `)) > 0;
}

async function indexExists(table, indexName) {
  return (await scalar(`
    SELECT COUNT(*) AS count
    FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = '${table}' AND index_name = '${indexName}'
  `)) > 0;
}

async function looksAlreadyApplied(filename) {
  switch (filename) {
    case '20260908_activity_logs.sql':
      return tableExists('activity_logs');
    case '20260908_add_user_phone.sql':
      return columnExists('users', 'phone');
    case '20260908_ip_pools.sql':
      return tableExists('ip_pools');
    case '20260908_invoices.sql':
      return tableExists('invoices');
    case '20260908_monitoring_errors.sql':
      return tableExists('monitoring_errors');
    case '20260908_router_wireguard.sql':
      return (await tableExists('vpn_servers')) && (await tableExists('vpn_clients')) && (await columnExists('nas', 'auth_mode'));
    case '20260908_packages_upgrade.sql':
      return columnExists('pppoe_packages', 'validity_days');
    case '20260908_accounts_upgrade.sql':
      return columnExists('pppoe_accounts', 'subscription_type');
    case '20260917_customer_number.sql':
      return columnExists('pppoe_accounts', 'customer_number');
    case '20260917_customer_services.sql':
      return (await tableExists('customer_addons')) && (await tableExists('payment_promises'));
    case '20260917_monitoring_stats.sql':
      return (await tableExists('server_stats')) && (await tableExists('router_stats')) && (await tableExists('server_stats_monthly'));
    default:
      return false;
  }
}

async function ensureTrackingTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS _unzanet_sql_migrations (
      filename VARCHAR(191) NOT NULL PRIMARY KEY,
      feature VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

async function markApplied(filename, feature, hash) {
  await prisma.$executeRawUnsafe(
    'INSERT IGNORE INTO _unzanet_sql_migrations (filename, feature, checksum) VALUES (?, ?, ?)',
    filename,
    feature,
    hash,
  );
}

async function main() {
  if (!existsSync(updatesDir)) {
    console.log('Folder migrasi tidak ditemukan:', updatesDir);
    return;
  }

  await ensureTrackingTable();

  const appliedRows = await prisma.$queryRawUnsafe('SELECT filename FROM _unzanet_sql_migrations');
  const applied = new Set(appliedRows.map((row) => row.filename));

  const files = readdirSync(updatesDir)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    console.log('Tidak ada file migrasi SQL.');
    return;
  }

  console.log('Daftar migrasi:');

  let ran = 0;
  let skipped = 0;

  for (const [index, filename] of files.entries()) {
    const filePath = path.join(updatesDir, filename);
    const sql = readFileSync(filePath, 'utf8').trim();
    const feature = features.get(filename) ?? filename.replace(/^\d+_?/, '').replace(/\.sql$/, '').replaceAll('_', ' ');
    const hash = checksum(sql);
    const number = String(index + 1).padStart(2, '0');

    if (applied.has(filename)) {
      console.log(`${number}. ${feature} - sudah pernah dijalankan`);
      skipped += 1;
      continue;
    }

    if (await looksAlreadyApplied(filename)) {
      await markApplied(filename, feature, hash);
      console.log(`${number}. ${feature} - sudah ada di database, ditandai selesai`);
      skipped += 1;
      continue;
    }

    if (!sql) {
      await markApplied(filename, feature, hash);
      console.log(`${number}. ${feature} - file kosong, ditandai selesai`);
      skipped += 1;
      continue;
    }

    console.log(`${number}. ${feature} - menjalankan migrasi`);
    execFileSync('npx', ['prisma', 'db', 'execute', '--file', filePath, '--schema', path.join(backendDir, 'prisma', 'schema.prisma')], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    await markApplied(filename, feature, hash);
    ran += 1;
  }

  console.log(`Migrasi selesai. Baru dijalankan: ${ran}. Dilewati/ditandai: ${skipped}.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
