// Compile into an isolated directory; a compiler failure must preserve the running build.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildBackend(root, run = spawnSync) {
  const backend = join(root, 'backend');
  const dist = join(backend, 'dist');
  if (existsSync(dist) && (!lstatSync(dist).isDirectory() || lstatSync(dist).isSymbolicLink())) throw new Error('Folder dist backend tidak valid.');
  const staging = mkdtempSync(join(backend, '.dist-stage-'));
  const backup = `${staging}.previous`;
  let promoted = false;
  try {
    const result = run(process.execPath, [join(backend, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--outDir', staging, '--incremental', 'false'], { cwd: backend, stdio: 'inherit' });
    if (result.error || result.status !== 0 || !existsSync(join(staging, 'main.js'))) throw new Error('Build backend gagal; dist sebelumnya dipertahankan.');
    // mkdtemp creates mode 0700 on Linux. The updater runs as root, while
    // systemd runs Node as the application user; normalize the entire new tree.
    function runtimePermissions(directory) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) runtimePermissions(path);
        else if (entry.isFile()) chmodSync(path, 0o644);
        else throw new Error('Jenis file build backend tidak didukung.');
      }
      chmodSync(directory, 0o755);
    }
    runtimePermissions(staging);
    if (existsSync(dist)) renameSync(dist, backup);
    try { renameSync(staging, dist); promoted = true; }
    catch (error) { if (existsSync(backup)) renameSync(backup, dist); throw error; }
  } finally {
    rmSync(staging, { recursive: true, force: true });
    if (promoted) rmSync(backup, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { buildBackend(resolve(dirname(fileURLToPath(import.meta.url)), '..')); console.log('[UNZANET] Build backend siap.'); }
  catch (error) { console.error(`[UNZANET] ${error.message}`); process.exitCode = 1; }
}
