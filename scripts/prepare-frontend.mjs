// Build on the developer's machine; commit releases/frontend.tar.gz to Git.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = join(root, 'frontend');
function run(command, args, cwd = root, capture = false) {
  const result = spawnSync(command, args, { cwd, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8', env: process.env });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr?.trim() || `${command} gagal (${result.status}).`);
  return result.stdout?.trim();
}
function sourceTree() {
  if (run('git', ['status', '--porcelain', '--untracked-files=all', '--', 'frontend'], root, true)) {
    throw new Error('Simpan perubahan frontend ke commit dahulu, lalu ulangi npm run preparefe.');
  }
  return run('git', ['rev-parse', 'HEAD:frontend'], root, true);
}
function hashes(directory, prefix = '') {
  const files = {};
  for (const name of readdirSync(directory).sort()) {
    const full = join(directory, name);
    const relative = prefix + name;
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`Symlink tidak boleh dalam paket: ${relative}`);
    if (stat.isDirectory()) Object.assign(files, hashes(full, relative + '/'));
    else if (stat.isFile()) files[relative] = createHash('sha256').update(readFileSync(full)).digest('hex');
    else throw new Error(`Jenis file tidak didukung: ${relative}`);
  }
  return files;
}

let staging;
let pending;
try {
  if (process.argv.length !== 2) throw new Error('Jalankan: npm run preparefe');
  if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Gunakan Node.js 22 pada laptop.');
  const tree = sourceTree();
  run('tar', ['--version'], root, true);
  console.log('[UNZANET] Install dependency frontend di laptop');
  if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm ci'], frontend);
  else run('npm', ['ci'], frontend);
  console.log('[UNZANET] Build produksi di laptop');
  run(process.execPath, [join(frontend, 'node_modules/@angular/cli/bin/ng.js'),
    'build', '--configuration=production', '--delete-output-path=true'], frontend);
  if (sourceTree() !== tree) throw new Error('Kode frontend berubah saat build; ulangi setelah commit.');
  const browser = join(frontend, 'dist/frontend/browser');
  if (!existsSync(join(browser, 'index.html'))) throw new Error('Hasil build tidak memiliki index.html.');
  staging = mkdtempSync(join(tmpdir(), 'unzanet-frontend-'));
  cpSync(browser, join(staging, 'browser'), { recursive: true });
  writeFileSync(join(staging, 'manifest.json'), JSON.stringify({ version: 1, sourceTree: tree, files: hashes(join(staging, 'browser')) }, null, 2));
  mkdirSync(join(root, 'releases'), { recursive: true });
  pending = join(root, 'releases', `frontend-${process.pid}.tar.gz`);
  run('tar', ['-czf', pending, '-C', staging, 'manifest.json', 'browser']);
  renameSync(pending, join(root, 'releases/frontend.tar.gz'));
  console.log('[UNZANET] Paket siap di-commit: releases/frontend.tar.gz');
  console.log('[UNZANET] Commit dan push paket ini ke GitHub. Server mengambilnya melalui git pull saat npm run install atau npm run updatefe.');
} catch (error) {
  console.error(`[UNZANET] ${error.message}`);
  process.exitCode = 1;
} finally {
  if (staging) rmSync(staging, { recursive: true, force: true });
  if (pending) rmSync(pending, { force: true });
}
