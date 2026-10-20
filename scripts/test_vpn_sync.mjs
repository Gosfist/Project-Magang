import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderAccounts, sync } from './vpn-sync.mjs';

const key = 'test-only-worker-key';
function client(overrides = {}) {
  const iv = Buffer.alloc(12, 1), cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(key).digest(), iv);
  const encrypted = Buffer.concat([cipher.update('test-password-123'), cipher.final()]);
  return { id: 1n, username: 'vpn_router01', vpnIp: '10.88.0.2', updatedAt: new Date(), provisionedAt: null, passwordEncrypted: `unzanet:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`, ...overrides };
}
test('writes usable static SSTP identities and rejects injection, duplicate IPs, and tampered encryption', () => {
  const c = client();
  assert.match(renderAccounts([c], key), /vpn_router01 \* test-password-123 10\.88\.0\.2\n/);
  for (const bad of [client({ username: 'evil\naccount' }), client({ vpnIp: '10.88.0.1' }), client({ vpnIp: '0.0.0.0' }), client({ passwordEncrypted: 'plaintext' })]) assert.throws(() => renderAccounts([bad], key));
  assert.throws(() => renderAccounts([c, client({ username: 'other' })], key));
  assert.throws(() => renderAccounts([c], 'wrong-key'));
});
test('acknowledges only after an atomic file replacement and preserves the old file on invalid input', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unzanet-vpn-test-'));
  try {
    const file = join(dir, 'chap-secrets'); await writeFile(file, 'old-account');
    const rows = [client()]; let applied = 0;
    const prisma = { vpnClient: { findMany: async () => rows, updateMany: async args => { assert.match(await readFile(file, 'utf8'), /vpn_router01/); assert.equal(args.where.id, 1n); applied++; } } };
    await sync(prisma, key, file); assert.equal(applied, 1);
    const previous = await readFile(file, 'utf8');
    rows[0].vpnIp = '1.2.3.4';
    await assert.rejects(sync(prisma, key, file)); assert.equal(await readFile(file, 'utf8'), previous); assert.equal(applied, 1);
  } finally { await rm(dir, { recursive: true }); }
});
