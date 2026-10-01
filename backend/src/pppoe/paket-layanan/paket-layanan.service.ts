import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';

import { SavePackageDto } from './paket-layanan.dto.js';

import { RadiusService } from '../shared/radius.service.js';
import { SecretService } from '../shared/secret.service.js';
import { PppoeNetworkService } from '../shared/pppoe-network.service.js';

import { WhatsappNotifyService } from '../../bot-whatsapp/shared/whatsapp-notify.service.js';

@Injectable()
export class PaketLayananService {
  private readonly logger = new Logger(PaketLayananService.name);

  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusService, private readonly secrets: SecretService, private readonly network: PppoeNetworkService, private readonly waNotify?: WhatsappNotifyService) { }

  async packages(search = '', page = 1) {
    const where = search ? { name: { contains: search } } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.pppoePackage.findMany({ where, include: { _count: { select: { accounts: true } }, ipPool: true }, orderBy: { name: 'asc' }, skip: (page - 1) * 5, take: 5 }),
      this.prisma.pppoePackage.count({ where }),
    ]);
    return serialize({ data: items.map((item) => ({ ...item, price: Number(item.price), costPrice: Number(item.costPrice), accountsCount: item._count.accounts, rateLimit: `${item.uploadMbps}M/${item.downloadMbps}M` })), meta: pageMeta(page, 5, total) });
  }

  async packageOptions() {
    const data = await this.prisma.pppoePackage.findMany({ include: { ipPool: true }, orderBy: { name: 'asc' } });
    return serialize({ data: data.map((item) => ({ ...item, price: Number(item.price), costPrice: Number(item.costPrice) })) });
  }

  async createPackage(dto: SavePackageDto) {
    try {
      const now = new Date();
      const item = await this.prisma.pppoePackage.create({
        data: {
          ...dto,
          addressPool: dto.addressPool?.trim() || null,
          price: BigInt(dto.price),
          costPrice: BigInt(dto.costPrice || 0),
          ipPoolId: null,
          validityDays: dto.validityDays ?? 30,
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        include: { ipPool: true }
      });
      return serialize({ message: 'Harga paket berhasil ditambahkan.', package: { ...item, price: Number(item.price), costPrice: Number(item.costPrice) } });
    } catch (error) { this.unique(error, 'Nama paket sudah digunakan.'); }
  }

  async updatePackage(id: string, dto: SavePackageDto) {
    await this.findPackage(id);
    try {
      const item = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.pppoePackage.update({
          where: { id: BigInt(id) },
          data: {
            ...dto,
            addressPool: dto.addressPool?.trim() || null,
            price: BigInt(dto.price),
            costPrice: BigInt(dto.costPrice || 0),
            ipPoolId: null,
            validityDays: dto.validityDays ?? 30,
            updatedAt: new Date()
          },
          include: { ipPool: true }
        });
        const accounts = await tx.pppoeAccount.findMany({ where: { pppoePackageId: updated.id }, include: { package: { include: { ipPool: true } } } });
        for (const account of accounts) await this.radius.sync(tx, account);
        return updated;
      });
      return serialize({ message: 'Harga paket berhasil diperbarui dan disinkronkan ke RADIUS.', package: { ...item, price: Number(item.price), costPrice: Number(item.costPrice) } });
    } catch (error) { this.unique(error, 'Nama paket sudah digunakan.'); }
  }

  async togglePackage(id: string) {
    const current = await this.findPackage(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.pppoePackage.update({ where: { id: current.id }, data: { isActive: !current.isActive } });
      const accounts = await tx.pppoeAccount.findMany({ where: { pppoePackageId: item.id }, include: { package: { include: { ipPool: true } } } });
      for (const account of accounts) await this.radius.sync(tx, account);
      return item;
    });
    const warnings: string[] = [];
    if (!updated.isActive) {
      const accounts = await this.prisma.pppoeAccount.findMany({ where: { pppoePackageId: updated.id } });
      for (const account of accounts) warnings.push(...(await this.network.disconnect(account.username, account.routerNasId)).warnings);
    }
    const message = `Harga paket berhasil ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`;
    return { message: warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : message, warnings, isActive: updated.isActive };
  }

  async removePackage(id: string) {
    const item = await this.findPackage(id);
    if (await this.prisma.pppoeAccount.count({ where: { pppoePackageId: item.id } })) throw new BadRequestException('Paket masih digunakan akun PPPoE dan tidak dapat dihapus.');
    await this.prisma.pppoePackage.delete({ where: { id: item.id } });
    return { message: 'Harga paket berhasil dihapus.' };
  }

  private async findPackage(id: string) {
    const item = await this.prisma.pppoePackage.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('Harga paket tidak ditemukan.');
    return item;
  }
  private unique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '');
      if (/id_card_number|idCardNumber/.test(target)) throw new ConflictException('Nomor KTP sudah digunakan pelanggan lain.');
      if (/phone/.test(target)) throw new ConflictException('Nomor telepon sudah digunakan pelanggan lain.');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
