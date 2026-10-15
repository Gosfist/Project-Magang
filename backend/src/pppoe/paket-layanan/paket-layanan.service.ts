import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';

import { SavePackageDto } from './paket-layanan.dto.js';

import { RadiusService } from '../shared/radius.service.js';
import { SecretService } from '../shared/secret.service.js';
import { PppoeNetworkService } from '../shared/pppoe-network.service.js';

import { WhatsappNotifyService } from '../../bot-whatsapp/shared/whatsapp-notify.service.js';
import { isolationPoolInUse } from '../shared/isolation-config.js';

const popularPackageKey = 'landing_popular_package_id';

@Injectable()
export class PaketLayananService {
  private readonly logger = new Logger(PaketLayananService.name);

  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusService, private readonly secrets: SecretService, private readonly network: PppoeNetworkService, private readonly waNotify?: WhatsappNotifyService) { }

  async packages(search = '', page = 1) {
    const where = search ? { name: { contains: search } } : {};
    const [items, total, popular] = await this.prisma.$transaction([
      this.prisma.pppoePackage.findMany({ where, include: { _count: { select: { accounts: true } }, ipPool: true }, orderBy: { name: 'asc' }, skip: (page - 1) * 5, take: 5 }),
      this.prisma.pppoePackage.count({ where }),
      this.prisma.appSetting.findUnique({ where: { key: popularPackageKey } }),
    ]);
    return serialize({ data: items.map((item) => ({ ...item, isPopular: String(item.id) === popular?.value, price: Number(item.price), costPrice: Number(item.costPrice), accountsCount: item._count.accounts, rateLimit: `${item.uploadMbps}M/${item.downloadMbps}M` })), meta: pageMeta(page, 5, total) });
  }

  async publicPackages() {
    const [items, popular] = await this.prisma.$transaction([
      this.prisma.pppoePackage.findMany({
        where: { isActive: true },
        select: { id: true, name: true, price: true, downloadMbps: true },
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.appSetting.findUnique({ where: { key: popularPackageKey } }),
    ]);
    return serialize({ data: items.map(item => ({
      id: item.id, name: item.name, price: Number(item.price), downloadMbps: item.downloadMbps,
      isPopular: String(item.id) === popular?.value,
    })) });
  }

  // One setting stores one package ID, including when two admins save concurrently.
  private async savePopular(tx: Prisma.TransactionClient, id: bigint, selected?: boolean) {
    if (selected === true) {
      await tx.appSetting.upsert({ where: { key: popularPackageKey },
        create: { key: popularPackageKey, value: String(id) }, update: { value: String(id) } });
    } else if (selected === false) {
      await tx.appSetting.deleteMany({ where: { key: popularPackageKey, value: String(id) } });
    }
  }

  async packageOptions() {
    const data = await this.prisma.pppoePackage.findMany({ include: { ipPool: true }, orderBy: { name: 'asc' } });
    return serialize({ data: data.map((item) => ({ ...item, price: Number(item.price), costPrice: Number(item.costPrice) })) });
  }

  async createPackage(dto: SavePackageDto) {
    if (dto.addressPool && await isolationPoolInUse(this.prisma, dto.addressPool.trim())) throw new BadRequestException('Pool isolir tidak boleh digunakan sebagai pool internet paket.');
    try {
      const now = new Date();
      const { isPopular, ...data } = dto;
      const item = await this.prisma.$transaction(async tx => {
        const created = await tx.pppoePackage.create({
          data: {
            ...data,
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
        await this.savePopular(tx, created.id, isPopular);
        return created;
      });
      return serialize({ message: 'Harga paket berhasil ditambahkan.', package: { ...item, price: Number(item.price), costPrice: Number(item.costPrice) } });
    } catch (error) { this.unique(error, 'Nama paket sudah digunakan.'); }
  }

  async updatePackage(id: string, dto: SavePackageDto) {
    if (dto.addressPool && await isolationPoolInUse(this.prisma, dto.addressPool.trim())) throw new BadRequestException('Pool isolir tidak boleh digunakan sebagai pool internet paket.');
    const current = await this.findPackage(id);
    const networkChanged = current.downloadMbps !== dto.downloadMbps
      || current.uploadMbps !== dto.uploadMbps
      || (current.ipPool?.name || current.addressPool || '') !== (dto.addressPool?.trim() || '');
    try {
      const { isPopular, ...data } = dto;
      const { item, accounts } = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.pppoePackage.update({
          where: { id: BigInt(id) },
          data: {
            ...data,
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
        await this.savePopular(tx, updated.id, isPopular);
        return { item: updated, accounts };
      });
      const warnings: string[] = [];
      if (networkChanged) {
        // RADIUS replies apply at authentication, not to an existing PPP session.
        // Reauthenticate after commit; RouterOS dynamic queues cannot be edited
        // reliably across versions. This is the reference stack's fallback.
        for (const account of accounts) {
          try { warnings.push(...(await this.network.disconnect(account.username, account.routerNasId)).warnings); }
          catch { warnings.push(`Sesi ${account.username} belum dapat disambungkan ulang. Limit baru berlaku saat pelanggan login kembali.`); }
        }
      }
      const message = networkChanged
        ? 'Harga paket dan RADIUS diperbarui. Sesi pelanggan disambungkan ulang agar kecepatan dan IP pool terbaru diterapkan.'
        : 'Harga paket berhasil diperbarui dan disinkronkan ke RADIUS.';
      return serialize({ message: warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : message,
        warnings, package: { ...item, price: Number(item.price), costPrice: Number(item.costPrice) } });
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
    await this.prisma.$transaction(async tx => {
      await tx.pppoePackage.delete({ where: { id: item.id } });
      await this.savePopular(tx, item.id, false);
    });
    return { message: 'Harga paket berhasil dihapus.' };
  }

  private async findPackage(id: string) {
    const item = await this.prisma.pppoePackage.findUnique({ where: { id: BigInt(id) }, include: { ipPool: true } });
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
