import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
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

test('root-created staging becomes readable and traversable by the service user', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t);
  buildBackend(root, (_command, args) => {
    const output = args[args.indexOf('--outDir') + 1];
    mkdirSync(join(output, 'nested'), { mode: 0o700 });
    writeFileSync(join(output, 'main.js'), 'export {};', { mode: 0o600 });
    writeFileSync(join(output, 'nested/module.js'), 'export {};', { mode: 0o600 });
    return { status: 0 };
  });
  for (const directory of ['dist', 'dist/nested']) assert.equal(statSync(join(root, 'backend', directory)).mode & 0o777, 0o755);
  for (const file of ['dist/main.js', 'dist/nested/module.js']) assert.equal(statSync(join(root, 'backend', file)).mode & 0o777, 0o644);
});
