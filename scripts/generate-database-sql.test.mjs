import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderDatabaseSql } from './generate-database-sql.mjs';

test('fresh install SQL contains current tables without legacy migrations or destructive cleanup', () => {
  const sql = readFileSync(new URL('../backend/prisma/database.sql', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /\b(?:DROP TABLE|DELETE FROM|RENAME TABLE|TRUNCATE TABLE)\b/i);
  assert.doesNotMatch(sql, /CREATE TABLE IF NOT EXISTS/i);
  assert.doesNotMatch(sql, /_unzanet_sql_migrations|migrate:updates|prisma\/updates/);
  assert.match(sql, /CREATE TABLE `daftar_pelanggan`/);
  assert.match(sql, /CREATE TABLE `website_settings`/);
  assert.match(sql, /`additional_roles` JSON NULL/);
  assert.match(sql, /`title` VARCHAR\(100\) NULL/);
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.scripts['migrate:updates'], undefined);
  const deploy = readFileSync(new URL('./server-update.sh', import.meta.url), 'utf8');
  assert.doesNotMatch(deploy, /mysql.*<.*database\.sql|prisma db push/);
  assert.doesNotMatch(deploy, /upgrade-zero-api|prisma\/updates|database\.sha256/);
  const nasTable = sql.match(/CREATE TABLE `nas` \([\s\S]*?\n\)/)?.[0];
  assert.ok(nasTable);
  assert.doesNotMatch(nasTable, /`(?:username|password|port|auth_mode)`/);
  assert.match(nasTable, /`coa_port` SMALLINT UNSIGNED NOT NULL DEFAULT 3799/);
  assert.doesNotMatch(sql, /CREATE TABLE `router_stats/);
});

test('SQL generation is stable across Windows and Ubuntu line endings', () => {
  const schema = 'CREATE TABLE test (id INT PRIMARY KEY);';
  assert.equal(renderDatabaseSql(schema + '\r\n'), renderDatabaseSql(schema + '\n'));
});

test('failed schema generation cannot produce an install file containing only settings', () => {
  assert.throws(() => renderDatabaseSql(''));
});
