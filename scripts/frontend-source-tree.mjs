// Hash the working frontend with Git filters, without changing the real index.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function sourceTree(root) {
  const staging = mkdtempSync(join(tmpdir(), 'unzanet-source-'));
  const env = { ...process.env, GIT_INDEX_FILE: join(staging, 'index') };
  function git(args) {
    const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr?.trim() || 'Gagal membaca kode frontend.');
    return result.stdout.trim();
  }
  try {
    git(['read-tree', 'HEAD']);
    git(['add', '-A', '--', 'frontend']);
    const tree = git(['write-tree']);
    return git(['rev-parse', `${tree}:frontend`]);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}
