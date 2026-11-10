import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBackend } from './build-backend.mjs';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'unzanet-build-audit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'backend/dist'), { recursive: true });
  writeFileSync(join(root, 'backend/dist/main.js'), 'previous build');
  return root;
}
test('compiler failure preserves the previous runtime even after emitting partial output', t => {
  const root = fixture(t);
  assert.throws(() => buildBackend(root, (_command, args) => { writeFileSync(join(args[args.indexOf('--outDir') + 1], 'main.js'), 'partial'); return { status: 1 }; }), /dist sebelumnya/);
  assert.equal(readFileSync(join(root, 'backend/dist/main.js'), 'utf8'), 'previous build');
  assert.deepEqual(readdirSync(join(root, 'backend')), ['dist']);
});
test('successful compilation replaces dist and removes stale modules', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'backend/dist/obsolete.js'), 'old');
  buildBackend(root, (_command, args) => { writeFileSync(join(args[args.indexOf('--outDir') + 1], 'main.js'), 'new build'); return { status: 0 }; });
  assert.equal(readFileSync(join(root, 'backend/dist/main.js'), 'utf8'), 'new build');
  assert.equal(existsSync(join(root, 'backend/dist/obsolete.js')), false);
  assert.deepEqual(readdirSync(join(root, 'backend')), ['dist']);
});
test('missing entry point is rejected before replacing dist', t => {
  const root = fixture(t);
  assert.throws(() => buildBackend(root, () => ({ status: 0 })), /gagal/);
  assert.equal(readFileSync(join(root, 'backend/dist/main.js'), 'utf8'), 'previous build');
});
