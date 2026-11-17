import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PppoeNetworkService } from '../../pppoe/shared/pppoe-network.service.js';
import { outputPortCount } from './output-ports.js';

@Injectable()
export class MainCoreOutputService {
  constructor(private readonly prisma: PrismaService, private readonly network: PppoeNetworkService) {}

  async list(type: string, id: string) {
    if (!['odc', 'odp', 'rasio'].includes(type) || !/^\d+$/.test(id)) throw new NotFoundException('Titik tidak ditemukan.');
    const node = await this.prisma.mainCore.findFirst({ where: { id: BigInt(id), tipeTitik: type, deletedAt: null } });
    if (!node) throw new NotFoundException('Titik tidak ditemukan.');
    const [children, accounts] = await Promise.all([
      this.prisma.mainCore.findMany({ where: { parentId: node.id, deletedAt: null }, select: { id: true, namaTitik: true, tipeTitik: true, parentPortOut: true } }),
      this.prisma.pppoeAccount.findMany({ where: { odp: String(node.id), odpPort: { not: null } }, select: { id: true, customerNumber: true, customerName: true, username: true, routerNasId: true, odpPort: true } }),
    ]);
    const presence = await this.network.accountPresence(accounts);
    return {
      data: Array.from({ length: outputPortCount(node.spesifikasi) }, (_, index) => {
        const port = index + 1;
        return {
          port,
          destinations: children.filter(child => child.parentPortOut === port).map(child => ({ id: String(child.id), name: child.namaTitik, type: child.tipeTitik })),
          customers: accounts.filter(account => account.odpPort === port).map(account => ({
            id: String(account.id), customerNumber: String(account.customerNumber).padStart(6, '0'), name: account.customerName,
            online: presence.states.get(account.username) ?? null,
          })),
        };
      }),
      warnings: presence.warnings,
    };
  }
}
