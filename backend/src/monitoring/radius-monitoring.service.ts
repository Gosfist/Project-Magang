import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { pageMeta, serialize } from '../common/serialize.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class RadiusMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async logs(search = '', reply = '', page = 1) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const perPage = 25;
    const where: Prisma.RadpostauthWhereInput = {};
    const q = search.trim();

    if (q) {
      where.OR = [
        { username: { contains: q } },
        { reply: { contains: q } },
        { pass: { contains: q } },
      ];
    }

    if (reply === 'accept') where.reply = { contains: 'Accept' };
    if (reply === 'reject') where.reply = { contains: 'Reject' };

    const [items, total, success, failed] = await this.prisma.$transaction([
      this.prisma.radpostauth.findMany({
        where,
        select: { id: true, username: true, pass: true, reply: true, authdate: true, class: true },
        orderBy: [{ authdate: 'desc' }, { id: 'desc' }],
        skip: (safePage - 1) * perPage,
        take: perPage,
      }),
      this.prisma.radpostauth.count({ where }),
      this.prisma.radpostauth.count({ where: { ...where, reply: { contains: 'Accept' } } }),
      this.prisma.radpostauth.count({ where: { ...where, reply: { contains: 'Reject' } } }),
    ]);

    return serialize({
      data: items,
      meta: pageMeta(safePage, perPage, total),
      summary: { total, success, failed },
    });
  }
}
