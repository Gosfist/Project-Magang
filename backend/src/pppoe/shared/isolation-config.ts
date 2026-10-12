import { BadRequestException } from '@nestjs/common';
import { isIPv4 } from 'node:net';
import type { Prisma } from '@prisma/client';

export const ISOLATION_COMMENT = 'UNZANET-ISOLIR:';
export interface IsolationConfig { enabled: boolean; poolName: string; subnet: string; localAddress: string; profileName: string; syncPending?: boolean }
export const isolationKey = (routerId: number) => `pppoe_isolation_router_${routerId}`;
export const isolationProfile = (routerId: number) => `UNZANET-ISOLIR-${routerId}`;
export const emptyIsolation = (): IsolationConfig => ({ enabled: false, poolName: '', subnet: '', localAddress: '', profileName: '' });

export async function readIsolation(tx: Pick<Prisma.TransactionClient, 'appSetting'>, routerId: number | null | undefined): Promise<IsolationConfig> {
  if (!routerId) return emptyIsolation();
  const row = await tx.appSetting.findUnique({ where: { key: isolationKey(routerId) } });
  if (!row) return emptyIsolation();
  try {
    const value = JSON.parse(row.value) as IsolationConfig;
    if (value.enabled !== true) return emptyIsolation();
    if (!value.poolName || value.profileName !== isolationProfile(routerId)) throw new Error();
    subnetBounds(value.subnet);
    if (!isIPv4(value.localAddress)) throw new Error();
    return value;
  } catch { throw new BadRequestException('Konfigurasi pool isolir tidak valid. Perbaiki di pengaturan Isolir PPPoE.'); }
}

export const ipNumber = (ip: string) => ip.split('.').reduce((n, part) => n * 256 + Number(part), 0);
export function subnetBounds(subnet: string): [number, number] {
  const [ip, prefix, extra] = subnet.split('/');
  if (!isIPv4(ip) || !/^\d{1,2}$/.test(prefix ?? '') || extra || Number(prefix) < 8 || Number(prefix) > 30) throw new BadRequestException('Subnet IPv4 harus /8 sampai /30.');
  const size = 2 ** (32 - Number(prefix));
  const start = Math.floor(ipNumber(ip) / size) * size;
  if (start !== ipNumber(ip)) throw new BadRequestException('Gunakan alamat network subnet, misalnya 192.168.100.0/24.');
  return [start, start + size - 1];
}

export function rangeIntervals(ranges: string): [number, number][] {
  return ranges.split(',').map(part => {
    const pair = part.trim().split('-').map(value => value.trim());
    if (!pair.length || pair.length > 2 || !pair.every(isIPv4)) throw new BadRequestException('Rentang pool isolir harus IPv4 yang valid.');
    const start = ipNumber(pair[0]), end = ipNumber(pair[1] || pair[0]);
    if (end < start) throw new BadRequestException('Rentang IP pool tidak valid.');
    return [start, end];
  });
}

export function isolatedService(account: { isActive: boolean; expiresAt: Date | null; package: { isActive: boolean } }, promise: { deadline: Date } | null, now = Date.now()) {
  return !account.isActive || !account.package.isActive || (promise ? promise.deadline.getTime() <= now : !!account.expiresAt && account.expiresAt.getTime() + 86400000 <= now);
}

export async function isolationPoolInUse(tx: Pick<Prisma.TransactionClient, 'appSetting'>, name: string, routerId?: number) {
  const rows = await tx.appSetting.findMany({ where: { key: { startsWith: 'pppoe_isolation_router_' } } });
  return rows.some(row => {
    try {
      const config = JSON.parse(row.value) as IsolationConfig;
      return (config.enabled || config.syncPending) && config.poolName === name && (!routerId || row.key === isolationKey(routerId));
    } catch { throw new BadRequestException('Konfigurasi isolir tersimpan rusak. Perbaiki konfigurasi sebelum mengubah pool.'); }
  });
}
