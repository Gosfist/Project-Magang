import { Injectable } from '@nestjs/common';
import type { IpPool, Nas } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MikrotikService } from '../router/mikrotik.service.js';

export interface NetworkResult { warnings: string[]; completed: number }

@Injectable()
export class PppoeNetworkService {
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService) {}

  async syncPool(pool: IpPool): Promise<NetworkResult> {
    // Pools are global in this application's schema, so deploy to every active NAS.
    const routers = await this.prisma.nas.findMany({ where: { isActive: true } });
    if (!routers.length) return { completed: 0, warnings: ['Belum ada Router/NAS aktif. Tambahkan router lalu gunakan Sinkronkan.'] };
    return this.onRouters(routers, (router) => this.mikrotik.withRouter(router, async (write) => {
      const existing = await write('/ip/pool/print', [`?name=${pool.name}`, '=.proplist=.id,name,ranges']);
      const ranges = `${pool.networkStart}-${pool.networkEnd}`;
      if (existing.length) {
        if (existing[0].ranges !== ranges) await write('/ip/pool/set', [`=.id=${existing[0]['.id']}`, `=ranges=${ranges}`]);
      } else {
        await write('/ip/pool/add', [`=name=${pool.name}`, `=ranges=${ranges}`, '=comment=UNZANET PPPoE']);
      }
    }));
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
