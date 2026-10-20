// Fixed read-only Accel-PPP command; the web process never receives CLI access.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isIPv4 } from 'node:net';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);
export function parseSessions(output) {
  const lines = output.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const columns = lines.shift()?.split('|').map(cell => cell.trim().toLowerCase());
  if (columns?.join(',') !== 'username,ip,type,state') throw new Error('Invalid sessions header');
  const sessions = [];
  for (const line of lines) {
    if (/^[\s+|-]+$/.test(line)) continue;
    const cells = line.split('|').map(cell => cell.trim());
    if (cells.length !== 4) throw new Error('Invalid session row');
    const [username, ip, type, state] = cells;
    if (type.toLowerCase() !== 'sstp' || state.toLowerCase() !== 'active') continue;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(username) || !isIPv4(ip)) throw new Error('Invalid SSTP identity');
    sessions.push({ username, ip });
  }
  return sessions;
}

export async function collectStatus(destination = '/run/unzanet-vpn-status/sessions.json', run = execute, now = () => new Date()) {
  let available = false, sessions = [];
  try {
    const { stdout } = await run('/usr/bin/accel-cmd', ['show', 'sessions', 'username,ip,type,state'], { timeout: 5000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' });
    sessions = parseSessions(stdout);
    available = true;
  } catch { /* Failure must become unknown, never a false offline result. */ }
  const snapshot = { checkedAt: now().toISOString(), available, sessions };
  await writeFile(destination + '.tmp', JSON.stringify(snapshot), { mode: 0o644 });
  await rename(destination + '.tmp', destination);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.getuid?.() !== 0) throw new Error('Root worker required');
  await mkdir('/run/unzanet-vpn-status', { recursive: true, mode: 0o755 });
  await collectStatus();
}
