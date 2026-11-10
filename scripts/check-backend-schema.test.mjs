import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { missingSchema } from './check-backend-schema.mjs';
const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { Prisma } = require('@prisma/client');
const models = Prisma.dmmf.datamodel.models;
const columns = models.flatMap(model => model.fields.filter(field => field.kind !== 'object').map(field => ({ tableName: model.dbName || model.name, columnName: field.dbName || field.name })));
const indexes = models.flatMap(model => {
  const fields = model.fields.filter(field => field.kind !== 'object');
  const names = new Map(fields.map(field => [field.name, field.dbName || field.name]));
  return [...model.uniqueFields, ...fields.filter(field => field.isUnique || field.isId).map(field => [field.name])].flatMap((constraint, i) => constraint.map((name, j) => ({ tableName: model.dbName || model.name, indexName: `unique${i}`, columnName: names.get(name), position: j + 1, nonUnique: 0 })));
});
test('accepts complete mapped columns and unique constraints without treating relations as columns', () => assert.deepEqual(missingSchema(models, columns, indexes), []));
test('detects the missing production odp_port column', () => assert.ok(missingSchema(models, columns.filter(row => !(row.tableName === 'daftar_pelanggan' && row.columnName === 'odp_port')), indexes).includes('kolom daftar_pelanggan.odp_port')));
test('rejects a normal index that does not enforce port uniqueness', () => {
  const incomplete = indexes.map(row => row.tableName === 'daftar_pelanggan' && indexes.some(other => other.tableName === row.tableName && other.indexName === row.indexName && other.columnName === 'odp_port') ? { ...row, nonUnique: 1 } : row);
  assert.ok(missingSchema(models, columns, incomplete).includes('index unik daftar_pelanggan(odp, odp_port)'));
});
