import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isIPv4 } from 'node:net';
import type { Prisma } from '@prisma/client';
import { rosQuote } from '../../pppoe/shared/router-script.js';
import { isolationProfile } from '../../pppoe/shared/isolation-config.js';

export type PrefixPool = { cidr: string; gateway: string; subnet: string; start: string; end: string };
export type NasNetwork = { internet: PrefixPool; isolation: PrefixPool; fingerprint: string };
export const networkKey = (id: number) => `nas_network_${id}`;
export const activeNetworkKey = (id: number) => `nas_network_active_${id}`;
export const internetPoolName = 'Internet';
export const isolationPoolName = 'pool-isolir';
export const internetProfile = (id: number) => `UNZANET-INTERNET-${id}`;
const number = (ip: string) => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0);
const address = (n: number) => [24, 16, 8, 0].map(shift => Math.floor(n / 2 ** shift) % 256).join('.');

export function prefixPool(value: string, label: string): PrefixPool {
  const [gateway, bits, extra] = value.trim().split('/');
  const prefix = Number(bits);
  if (!isIPv4(gateway) || !/^\d{1,2}$/.test(bits ?? '') || extra !== undefined || prefix < 8 || prefix > 30) {
    throw new BadRequestException(`${label}: isi IPv4 gateway dan prefix /8 sampai /30, misalnya 192.168.75.1/24.`);
  }
  const ip = number(gateway), size = 2 ** (32 - prefix), first = Math.floor(ip / size) * size, last = first + size - 1;
  if (ip === first || ip === last || ip < 2 ** 24 || ip >= 224 * 2 ** 24 || gateway.startsWith('127.')) {
    throw new BadRequestException(`${label}: gateway harus alamat host, bukan network atau broadcast.`);
  }
  // Prefer hosts after the gateway. A gateway at the last host uses hosts before it.
  const start = ip < last - 1 ? ip + 1 : first + 1, end = ip < last - 1 ? last - 1 : ip - 1;
  return { cidr: `${gateway}/${prefix}`, gateway, subnet: `${address(first)}/${prefix}`, start: address(start), end: address(end) };
}

export function networkContains(pool: PrefixPool, ip: string) {
  const [base, bits] = pool.subnet.split('/'), start = number(base), value = number(ip);
  return value >= start && value < start + 2 ** (32 - Number(bits));
}

export function nasNetwork(id: number, internetCidr: string, isolationCidr: string): NasNetwork {
  const internet = prefixPool(internetCidr, 'IP Pool Internet'), isolation = prefixPool(isolationCidr, 'IP Pool Isolir');
  if (networkContains(internet, isolation.gateway) || networkContains(isolation, internet.gateway)) {
    throw new BadRequestException('Subnet IP Pool Internet dan Isolir tidak boleh tumpang tindih.');
  }
  const fingerprint = createHash('sha256').update(JSON.stringify({ id, internet, isolation })).digest('hex');
  return { internet, isolation, fingerprint };
}

export async function readNasNetwork(tx: Pick<Prisma.TransactionClient, 'appSetting'>, id: number | null | undefined, active = true): Promise<NasNetwork | null> {
  if (!id) return null;
  const row = await tx.appSetting.findUnique({ where: { key: active ? activeNetworkKey(id) : networkKey(id) } });
  if (!row) return null;
  try {
    const data = JSON.parse(row.value) as NasNetwork;
    return nasNetwork(id, data.internet.cidr, data.isolation.cidr);
  } catch { throw new BadRequestException('Prefix pool Router/NAS tersimpan tidak valid. Perbaiki pada Edit Router NAS.'); }
}

export function nasNetworkScript(id: number, network: NasNetwork) {
  const q = rosQuote, lines = ['# 4. IP Pool Internet dan Isolir'];
  for (const [kind, pool, name, profile] of [
    ['INTERNET', network.internet, internetPoolName, internetProfile(id)],
    ['ISOLIR', network.isolation, isolationPoolName, isolationProfile(id)],
  ] as const) {
    lines.push(`/ip pool add name=${q(name)} ranges=${q(`${pool.start}-${pool.end}`)} next-pool=none comment=${q(`UNZANET-RADIUS:${kind}`)};`);
    lines.push(`/ppp profile add copy-from=default name=${q(profile)} local-address=${q(pool.gateway)} remote-address=${q(name)}${kind === 'ISOLIR' ? ' use-ipv6=no' : ''} only-one=yes change-tcp-mss=yes;`);
  }
  lines.push('', '# 5. Firewall subnet isolir');
  for (const [chain, field] of [['forward', 'src-address'], ['forward', 'dst-address'], ['input', 'src-address']] as const) {
    const comment = q('UNZANET-RADIUS:ISOLIR');
    lines.push(`/ip firewall filter add chain=${chain} ${field}=${q(network.isolation.subnet)} action=drop disabled=no comment=${comment};`);
  }
  lines.push('# Pastikan ketiga rule isolir berada sebelum accept/FastTrack melalui Winbox.');
  return lines.join('\n');
}
