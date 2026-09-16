import { BadRequestException, BadGatewayException, NotFoundException, Injectable } from '@nestjs/common';
import { poolUsage } from './pool-usage.js';
import type { Nas } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MikrotikService } from '../router/mikrotik.service.js';

export interface NetworkResult { warnings: string[]; completed: number }

@Injectable()
export class PppoeNetworkService {
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService) {}

  async accountPresence(accounts: { username: string; routerNasId: number | null }[]) {
    const states = new Map<string, boolean | null>();
    if (!accounts.length) return { states, warnings: [] as string[] };
    const routers = await this.prisma.nas.findMany({ where: accounts.some(account => account.routerNasId === null)
      ? { isActive: true } : { id: { in: [...new Set(accounts.map(account => account.routerNasId!))] }, isActive: true } });
    const sessions = new Map<number, Set<string>>();
    const result = await this.onRouters(routers, router => this.mikrotik.withRouter(router, async write => {
      const rows = await write('/ppp/active/print', ['=.proplist=name,service']);
      sessions.set(router.id, new Set(rows.filter(row => row.service === 'pppoe').map(row => row.name)));
    }));
    for (const account of accounts) {
      const targets = account.routerNasId === null ? routers : routers.filter(router => router.id === account.routerNasId);
      const online = targets.some(router => sessions.get(router.id)?.has(account.username));
      const known = targets.length > 0 && targets.every(router => sessions.has(router.id));
      states.set(account.username, online ? true : known ? false : null);
    }
    return { states, warnings: result.warnings };
  }

  async listPools() {
    const routers = await this.prisma.nas.findMany({ where: { isActive: true } });
    const data: { id: string; routerNasId: number; routerName: string; name: string; ranges: string; networkStart: string; networkEnd: string; totalIps: number | null; usedIps: number | null; freeIps: number | null }[] = [];
    const usageWarnings: string[] = [];
    const result = await this.onRouters(routers, (router) => this.mikrotik.withRouter(router, async (write) => {
      const rows = await write('/ip/pool/print', ['=.proplist=.id,name,ranges']);
      let used: Record<string, string>[] | null = null;
      try { used = await write('/ip/pool/used/print', ['=.proplist=pool,address']); }
      catch (error) { usageWarnings.push(`${router.name || router.nasname}: Penggunaan IP belum dapat dibaca. ${this.mikrotik.errorMessage(error)}`); }
      for (const row of rows) {
        const simple = /^(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)$/.exec(row.ranges);
        data.push({ id: `${router.id}:${row['.id']}`, routerNasId: router.id, routerName: router.name || router.nasname,
          ...poolUsage(row.ranges, used === null ? null : used.filter((entry) => entry.pool === row.name || entry.pool === row['.id']).map((entry) => entry.address)),
          name: row.name, ranges: row.ranges, networkStart: simple?.[1] || '', networkEnd: simple?.[2] || '' });
      }
    }));
    return { data: data.sort((a, b) => a.name.localeCompare(b.name) || a.routerNasId - b.routerNasId), warnings: [...result.warnings, ...usageWarnings] };
  }

  async poolRouter<T>(routerNasId: number, action: Parameters<MikrotikService['withRouter']>[1]): Promise<T> {
    const router = await this.prisma.nas.findUnique({ where: { id: routerNasId } });
    if (!router || !router.isActive) throw new BadRequestException('Pilih Router/NAS aktif.');
    try { return await this.mikrotik.withRouter(router, action) as T; }
    catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new BadGatewayException(this.mikrotik.errorMessage(error));
    }
  }

  poolIdentity(id: string) {
    const match = /^(\d+):(\*[0-9a-fA-F]+)$/.exec(id);
    if (!match) throw new BadRequestException('ID pool MikroTik tidak valid. Muat ulang daftar pool.');
    return { routerNasId: Number(match[1]), routerId: match[2] };
  }

  async disconnect(username: string, routerNasId: number | null): Promise<NetworkResult> {
    const sessions = await this.prisma.radacct.findMany({
      where: { username, acctstoptime: null }, select: { nasipaddress: true },
    });
    const addresses = [...new Set(sessions.map((session) => session.nasipaddress))];
    const routers = await this.prisma.nas.findMany({ where: routerNasId === null && !addresses.length ? { isActive: true } : { OR: [
      ...(routerNasId !== null ? [{ id: routerNasId }] : []),
      { nasname: { in: addresses } }, { ipAddress: { in: addresses } },
    ] } });
    const unknown = addresses.filter((address) => !routers.some((router) => router.nasname === address || router.ipAddress === address));
    const result = await this.onRouters(routers, (router) => this.mikrotik.withRouter(router, async (write) => {
      const active = await write('/ppp/active/print', [`?name=${username}`, '=.proplist=.id,name']);
      for (const session of active) {
        if (session.name === username && session['.id']) await write('/ppp/active/remove', [`=.id=${session['.id']}`]);
      }
      // Do not fabricate Accounting-Stop: FreeRADIUS records the router's real reply.
    }));
    if (!routers.length) result.warnings.push('Sesi belum dapat diverifikasi: Router/NAS pelanggan tidak ditemukan.');
    if (unknown.length) result.warnings.push('Ada sesi RADIUS pada NAS yang belum terdaftar; pemutusan sesi tersebut belum terverifikasi.');
    return result;
  }

  private async onRouters(routers: Nas[], action: (router: Nas) => Promise<unknown>): Promise<NetworkResult> {
    const result: NetworkResult = { warnings: [], completed: 0 };
    // Keep concurrency bounded so a large NAS list cannot exhaust sockets.
    for (let offset = 0; offset < routers.length; offset += 4) {
      const batch = routers.slice(offset, offset + 4);
      const outcomes = await Promise.allSettled(batch.map(action));
      outcomes.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled') result.completed++;
        else result.warnings.push(`${batch[index].name || batch[index].nasname}: ${this.mikrotik.errorMessage(outcome.reason)}`);
      });
    }
    return result;
  }
}
