import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { SaveAccountDto, SavePackageDto } from './pppoe.dto.js';
import { RadiusService } from './radius.service.js';
import { SecretService } from './secret.service.js';

@Injectable()
export class PppoeService {
  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusService, private readonly secrets: SecretService) { }

  async packages(search = '', page = 1) {
    const where = search ? { name: { contains: search } } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.pppoePackage.findMany({ where, include: { _count: { select: { accounts: true } } }, orderBy: { name: 'asc' }, skip: (page - 1) * 5, take: 5 }),
      this.prisma.pppoePackage.count({ where }),
    ]);
    return serialize({ data: items.map((item) => ({ ...item, price: Number(item.price), accountsCount: item._count.accounts, rateLimit: `${item.uploadMbps}M/${item.downloadMbps}M` })), meta: pageMeta(page, 5, total) });
  }

  async packageOptions() {
    const data = await this.prisma.pppoePackage.findMany({ orderBy: { name: 'asc' } });
    return serialize({ data: data.map((item) => ({ ...item, price: Number(item.price) })) });
  }

  async createPackage(dto: SavePackageDto) {
    try {
      const item = await this.prisma.pppoePackage.create({ data: { ...dto, addressPool: dto.addressPool?.trim() || null, price: BigInt(dto.price), isActive: true } });
      return serialize({ message: 'Paket PPPoE berhasil ditambahkan.', package: { ...item, price: Number(item.price) } });
    } catch (error) { this.unique(error, 'Nama paket sudah digunakan.'); }
  }

  async updatePackage(id: string, dto: SavePackageDto) {
    await this.findPackage(id);
    try {
      const item = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.pppoePackage.update({ where: { id: BigInt(id) }, data: { ...dto, addressPool: dto.addressPool?.trim() || null, price: BigInt(dto.price) } });
        const accounts = await tx.pppoeAccount.findMany({ where: { pppoePackageId: updated.id }, include: { package: true } });
        for (const account of accounts) await this.radius.sync(tx, account);
        return updated;
      });
      return serialize({ message: 'Paket PPPoE berhasil diperbarui dan disinkronkan ke RADIUS.', package: { ...item, price: Number(item.price) } });
    } catch (error) { this.unique(error, 'Nama paket sudah digunakan.'); }
  }

  async togglePackage(id: string) {
    const current = await this.findPackage(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.pppoePackage.update({ where: { id: current.id }, data: { isActive: !current.isActive } });
      const accounts = await tx.pppoeAccount.findMany({ where: { pppoePackageId: item.id }, include: { package: true } });
      for (const account of accounts) await this.radius.sync(tx, account);
      return item;
    });
    return { message: `Paket PPPoE berhasil ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`, isActive: updated.isActive };
  }

  async removePackage(id: string) {
    const item = await this.findPackage(id);
    if (await this.prisma.pppoeAccount.count({ where: { pppoePackageId: item.id } })) throw new BadRequestException('Paket masih digunakan akun PPPoE dan tidak dapat dihapus.');
    await this.prisma.pppoePackage.delete({ where: { id: item.id } });
    return { message: 'Paket PPPoE berhasil dihapus.' };
  }

  async accounts(search = '', page = 1) {
    const where: Prisma.PppoeAccountWhereInput = search ? { OR: [{ customerName: { contains: search } }, { username: { contains: search } }] } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.pppoeAccount.findMany({ where, include: { package: true }, omit: { password: true }, orderBy: { customerName: 'asc' }, skip: (page - 1) * 5, take: 5 }),
      this.prisma.pppoeAccount.count({ where }),
    ]);
    return serialize({ data: items.map((item) => ({ ...item, package: { ...item.package, price: Number(item.package.price) } })), meta: pageMeta(page, 5, total) });
  }

  async createAccount(dto: SaveAccountDto) {
    if (!dto.password) throw new BadRequestException('Password PPPoE wajib diisi.');
    await this.findPackage(dto.pppoePackageId);
    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const item = await tx.pppoeAccount.create({ data: this.accountData(dto, this.secrets.encrypt(dto.password!), true), include: { package: true } });
        await this.radius.sync(tx, item);
        return item;
      });
      const { password: _password, ...safe } = account;
      return serialize({ message: 'Akun PPPoE berhasil ditambahkan dan disinkronkan ke RADIUS.', account: safe });
    } catch (error) { this.unique(error, 'Username PPPoE sudah digunakan.'); }
  }

  async updateAccount(id: string, dto: SaveAccountDto) {
    const current = await this.findAccount(id);
    await this.findPackage(dto.pppoePackageId);
    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const item = await tx.pppoeAccount.update({
          where: { id: current.id },
          data: this.accountData(dto, dto.password ? this.secrets.encrypt(dto.password) : current.password, false),
          include: { package: true },
        });
        await this.radius.sync(tx, item, current.username);
        return item;
      });
      const { password: _password, ...safe } = account;
      return serialize({ message: 'Akun PPPoE berhasil diperbarui dan disinkronkan ke RADIUS.', account: safe });
    } catch (error) { this.unique(error, 'Username PPPoE sudah digunakan.'); }
  }

  async removeAccount(id: string) {
    const current = await this.findAccount(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.radcheck.deleteMany({ where: { username: current.username } });
      await tx.radreply.deleteMany({ where: { username: current.username } });
      await tx.pppoeAccount.delete({ where: { id: current.id } });
    });
    return { message: 'Akun PPPoE dan data RADIUS berhasil dihapus.' };
  }

  private accountData(dto: SaveAccountDto, password: string, creating: boolean) {
    const now = new Date();
    return {
      pppoePackageId: BigInt(dto.pppoePackageId), customerName: dto.customerName.trim(), username: dto.username.trim(), password,
      phone: dto.phone?.trim() || null, address: dto.address?.trim() || null,
      expiresAt: dto.expiresAt ? new Date(`${dto.expiresAt}T00:00:00.000Z`) : null,
      isActive: creating ? true : dto.isActive ?? false, notes: dto.notes?.trim() || null,
      updatedAt: now, ...(creating ? { createdAt: now } : {}),
    };
  }

  private async findPackage(id: string) {
    const item = await this.prisma.pppoePackage.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('Paket PPPoE tidak ditemukan.');
    return item;
  }
  private async findAccount(id: string) {
    const item = await this.prisma.pppoeAccount.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('Akun PPPoE tidak ditemukan.');
    return item;
  }
  private unique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException(message);
    throw error;
  }
}
