// Root-owned timer worker. Only this worker writes the private SSTP accounts file.
import { createRequire } from 'node:module';
import { createDecipheriv, createHash } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function renderAccounts(clients, secret) {
  const key = createHash('sha256').update(secret).digest();
  const usernames = new Set(), ips = new Set();
  return '# Managed by UNZANET VPN worker\n' + clients.map(c => {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(c.username) || !/^10\.88\.0\.(?:[2-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-4])$/.test(c.vpnIp) || usernames.has(c.username) || ips.has(c.vpnIp)) throw new Error('Invalid or duplicate SSTP identity');
    usernames.add(c.username); ips.add(c.vpnIp);
    if (!c.passwordEncrypted?.startsWith('unzanet:v1:')) throw new Error('Invalid SSTP credential');
    const [, , iv, tag, encrypted] = c.passwordEncrypted.split(':');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    const password = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
    if (!/^[a-zA-Z0-9_!@%+=.,:-]{12,128}$/.test(password)) throw new Error('Invalid SSTP password');
    return `${c.username} * ${password} ${c.vpnIp}\n`;
  }).join('');
}

export async function sync(prisma, secret, destination = '/etc/sstp-vpn/chap-secrets') {
  const clients = await prisma.vpnClient.findMany({ where: { vpnType: 'sstp', isActive: true }, orderBy: { id: 'asc' } });
  const contents = renderAccounts(clients, secret);
  // Accel-PPP 1.14 opens chap-secrets on each new authentication. No restart
  // or reload is required; established PPPoE and SSTP sessions are preserved.
  const pending = destination + '.tmp';
  await writeFile(pending, contents, { mode: 0o600 });
  await rename(pending, destination);
  for (const client of clients) if (!client.provisionedAt) await prisma.vpnClient.updateMany({
    where: { id: client.id, updatedAt: client.updatedAt, isActive: true }, data: { provisionedAt: new Date() },
  });
}

async function main() {
  if (process.getuid?.() !== 0) throw new Error('Root worker required');
  process.umask(0o077);
  const config = JSON.parse(await readFile('/etc/unzanet/install.json', 'utf8'));
  if (!config.JWT_SECRET || !config.DB_PASSWORD || !config.ROOT_DIR?.startsWith('/var/www/')) throw new Error('Invalid installer state');
  const require = createRequire(config.ROOT_DIR + '/backend/package.json');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: `mysql://unzanet:${config.DB_PASSWORD}@127.0.0.1:3306/unzanet`, log: [] });
  try {
    await sync(prisma, config.JWT_SECRET);
    await writeFile('/var/lib/unzanet-vpn/last-success', new Date().toISOString(), { mode: 0o600 });
    await unlink('/var/lib/unzanet-vpn/last-error').catch(error => { if (error.code !== 'ENOENT') throw error; });
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async () => {
    // Do not print exceptions containing SQL credentials or decrypted passwords.
    await mkdir('/var/lib/unzanet-vpn', { recursive: true, mode: 0o700 });
    await writeFile('/var/lib/unzanet-vpn/last-error', 'VPN synchronization failed; check database schema, JWT key, account format, and file permissions.\n', { mode: 0o600 });
    console.error('VPN synchronization failed. Accounts remain pending; check server configuration.');
    process.exitCode = 1;
  });
}
