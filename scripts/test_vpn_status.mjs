import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { parseSessions, collectStatus } from './vpn-status.mjs';

const header = ' username | ip | type | state\r\n----------+----+------+------\r\n';
test('an empty sessions table is valid, while only active SSTP rows count online', () => {
  assert.deepEqual(parseSessions(header), []);
  assert.deepEqual(parseSessions(header + 'vpn_a | 10.88.0.2 | sstp | active\n' + 'vpn_b | 10.88.0.3 | sstp | start\n' + 'vpn_c | 10.88.0.4 | sstp | finish\n' + 'customer | 10.99.0.2 | pppoe | active\n'), [{ username: 'vpn_a', ip: '10.88.0.2' }]);
});
test('CLI failures and malformed output cannot be confused with an empty session list', () => {
  for (const output of ['', 'Connection refused', 'username | state', header + 'truncated row', header + 'vpn_a | invalid | sstp | active']) assert.throws(() => parseSessions(output));
});
test('publishes a password-free snapshot atomically and replaces previous online data on errors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'unzanet-vpn-status-'));
  const destination = join(dir, 'sessions.json');
  const now = () => new Date('2026-10-20T04:00:00Z');
  try {
    await collectStatus(destination, async (file, args, options) => {
      assert.equal(file, '/usr/bin/accel-cmd');
      assert.deepEqual(args, ['show', 'sessions', 'username,ip,type,state']);
      assert.equal(options.timeout, 5000);
      return { stdout: header + 'vpn_a | 10.88.0.2 | sstp | active' };
    }, now);
    assert.deepEqual(JSON.parse(await readFile(destination, 'utf8')), { checkedAt: now().toISOString(), available: true, sessions: [{ username: 'vpn_a', ip: '10.88.0.2' }] });
    const failed = await collectStatus(destination, async () => { throw new Error('unavailable'); }, now);
    assert.equal(failed.available, false);
    assert.deepEqual(failed.sessions, []);
    assert.deepEqual(JSON.parse(await readFile(destination, 'utf8')), failed);
    const malformed = await collectStatus(destination, async () => ({ stdout: 'CLI error' }), now);
    assert.equal(malformed.available, false);
  } finally {
    assert.equal(dirname(dir), tmpdir());
    assert.ok(basename(dir).startsWith('unzanet-vpn-status-'));
    await rm(dir, { recursive: true });
  }
});
