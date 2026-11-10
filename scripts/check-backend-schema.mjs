// Read-only preflight. Never applies migrations or prints connection credentials.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function missingSchema(models, columns, indexes) {
  const present = new Set(columns.map(row => `${row.tableName}.${row.columnName}`));
  const unique = new Map();
  for (const row of indexes) {
    if (Number(row.nonUnique) !== 0) continue;
    const key = `${row.tableName}:${row.indexName}`;
    if (!unique.has(key)) unique.set(key, []);
    unique.get(key).push({ column: row.columnName, order: Number(row.position) });
  }
  const missing = [];
  for (const model of models) {
    const table = model.dbName || model.name;
    const fields = model.fields.filter(field => field.kind !== 'object');
    const byName = new Map(fields.map(field => [field.name, field.dbName || field.name]));
    for (const field of fields) {
      const column = byName.get(field.name);
      if (!present.has(`${table}.${column}`)) missing.push(`kolom ${table}.${column}`);
    }
    const constraints = [...(model.uniqueFields || []), ...fields.filter(field => field.isUnique || field.isId).map(field => [field.name])];
    for (const constraint of constraints) {
      const names = constraint.map(name => byName.get(name));
      if (names.some(name => !present.has(`${table}.${name}`))) continue;
      const found = [...unique.entries()].some(([key, rows]) => key.startsWith(`${table}:`) && rows.sort((a, b) => a.order - b.order).map(row => row.column).join(',') === names.join(','));
      if (!found) missing.push(`index unik ${table}(${names.join(', ')})`);
    }
  }
  return missing;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const env = join(root, 'backend/.env');
  if (existsSync(env)) process.loadEnvFile(env);
  const require = createRequire(join(root, 'backend/package.json'));
  const { PrismaClient, Prisma } = require('@prisma/client');
  const prisma = new PrismaClient({ log: [] });
  try {
    const columns = await prisma.$queryRaw`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()`;
    const indexes = await prisma.$queryRaw`SELECT TABLE_NAME AS tableName, INDEX_NAME AS indexName, COLUMN_NAME AS columnName, SEQ_IN_INDEX AS position, NON_UNIQUE AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()`;
    const missing = missingSchema(Prisma.dmmf.datamodel.models, columns, indexes);
    if (missing.length) {
      console.error('[UNZANET] Skema database belum sesuai. Backend belum dihentikan.');
      for (const item of missing.slice(0, 30)) console.error(`- ${item}`);
      console.error('Perbarui skema sesuai panduan, lalu ulangi update. Jangan impor ulang database.sql pada database berisi data.');
      process.exitCode = 1;
    } else console.log('[UNZANET] Kolom dan index unik database sesuai Prisma; tidak ada perubahan database.');
  } catch (error) {
    console.error(`[UNZANET] Pemeriksaan database gagal (${error.code || 'koneksi/izin'}). Backend belum dihentikan.`);
    process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
