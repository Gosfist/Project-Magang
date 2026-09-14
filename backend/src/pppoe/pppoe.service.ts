import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { SaveAccountDto, SavePackageDto } from './pppoe.dto.js';
import { SaveIpPoolDto } from './ip-pool.dto.js';
import { RadiusService } from './radius.service.js';
import { SecretService } from './secret.service.js';
import { PppoeNetworkService } from './pppoe-network.service.js';

@Injectable()
export class PppoeService {
  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusService, private readonly secrets: SecretService, private readonly network: PppoeNetworkService) { }

  async ipPools(search = '', page = 1) {
    const where = search ? { name: { contains: search } } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ipPool.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * 10, take: 10 }),
      this.prisma.ipPool.count({ where }),
    ]);
    return serialize({ data: items, meta: pageMeta(page, 10, total) });
  }

  async ipPoolOptions() {
    const data = await this.prisma.ipPool.findMany({ orderBy: { name: 'asc' } });
    return serialize({ data });
  }

  async createIpPool(dto: SaveIpPoolDto) {
    this.validatePoolRange(dto);
    try {
      const now = new Date();
      const item = await this.prisma.ipPool.create({ data: { ...dto, createdAt: now, updatedAt: now } });
      const sync = await this.network.syncPool(item);
      return serialize({ message: this.networkMessage('IP Pool tersimpan.', sync.warnings), warnings: sync.warnings, syncedRouters: sync.completed, pool: item });
    } catch (error) { this.unique(error, 'Nama IP Pool sudah digunakan.'); }
  }

  async updateIpPool(id: string, dto: SaveIpPoolDto) {
    this.validatePoolRange(dto);
    const pool = await this.prisma.ipPool.findUnique({ where: { id: BigInt(id) } });
    if (!pool) throw new NotFoundException('IP Pool tidak ditemukan.');
    if (pool.name !== dto.name && await this.prisma.pppoePackage.count({ where: { OR: [{ ipPoolId: pool.id }, { addressPool: pool.name }] } })) {
      throw new BadRequestException('Nama pool yang sedang digunakan paket tidak dapat diganti. Buat pool baru lalu pindahkan paket.');
    }
    try {
      const item = await this.prisma.ipPool.update({ where: { id: BigInt(id) }, data: { ...dto, updatedAt: new Date() } });
      const sync = await this.network.syncPool(item);
      return serialize({ message: this.networkMessage('IP Pool diperbarui.', sync.warnings), warnings: sync.warnings, syncedRouters: sync.completed, pool: item });
    } catch (error) { this.unique(error, 'Nama IP Pool sudah digunakan.'); }
  }

  async syncIpPool(id: string) {
    const pool = await this.prisma.ipPool.findUnique({ where: { id: BigInt(id) } });
    if (!pool) throw new NotFoundException('IP Pool tidak ditemukan.');
    const result = await this.network.syncPool(pool);
    return { ...result, message: this.networkMessage(`Sinkronisasi selesai pada ${result.completed} router.`, result.warnings) };
  }

  private validatePoolRange(dto: SaveIpPoolDto) {
    const numeric = (ip: string) => ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
    if (numeric(dto.networkStart) > numeric(dto.networkEnd)) throw new BadRequestException('Network Start harus lebih kecil atau sama dengan Network End.');
  }

  private networkMessage(message: string, warnings: string[]) {
    return warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : `${message} Operasi MikroTik berhasil.`;
  }

  async removeIpPool(id: string) {
    const count = await this.prisma.pppoePackage.count({ where: { ipPoolId: BigInt(id) } });
    if (count > 0) throw new BadRequestException('IP Pool masih digunakan oleh paket PPPoE dan tidak dapat dihapus.');
    await this.prisma.ipPool.delete({ where: { id: BigInt(id) } });
    return { message: 'IP Pool berhasil dihapus.' };
  }

  async nasOptions() {
    const data = await this.prisma.nas.findMany({ select: { id: true, nasname: true, shortname: true, description: true }, orderBy: { nasname: 'asc' } });
    return serialize({ data });
  }

  async odpOptions() {
    const data = await this.prisma.mainCore.findMany({ where: { tipeTitik: 'odp' }, select: { id: true, namaTitik: true, alamat: true }, orderBy: { namaTitik: 'asc' } });
    return serialize({ data });
  }

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
          ipPoolId: dto.ipPoolId ? BigInt(dto.ipPoolId) : null,
          validityDays: dto.validityDays ?? 30,
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        include: { ipPool: true }
      });
      return serialize({ message: 'Paket PPPoE berhasil ditambahkan.', package: { ...item, price: Number(item.price), costPrice: Number(item.costPrice) } });
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
            ipPoolId: dto.ipPoolId ? BigInt(dto.ipPoolId) : null,
            validityDays: dto.validityDays ?? 30,
            updatedAt: new Date()
          },
          include: { ipPool: true }
        });
        const accounts = await tx.pppoeAccount.findMany({ where: { pppoePackageId: updated.id }, include: { package: { include: { ipPool: true } } } });
        for (const account of accounts) await this.radius.sync(tx, account);
        return updated;
      });
      return serialize({ message: 'Paket PPPoE berhasil diperbarui dan disinkronkan ke RADIUS.', package: { ...item, price: Number(item.price), costPrice: Number(item.costPrice) } });
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
    const message = `Paket PPPoE berhasil ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`;
    return { message: warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : message, warnings, isActive: updated.isActive };
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
      this.prisma.pppoeAccount.findMany({ where, include: { package: { include: { ipPool: true } }, routerNas: true }, omit: { password: true }, orderBy: { customerName: 'asc' }, skip: (page - 1) * 5, take: 5 }),
      this.prisma.pppoeAccount.count({ where }),
    ]);
    return serialize({ data: items.map((item) => ({ ...item, discount: Number(item.discount), package: { ...item.package, price: Number(item.package.price), costPrice: Number(item.package.costPrice) } })), meta: pageMeta(page, 5, total) });
  }

  async createAccount(dto: SaveAccountDto) {
    if (!dto.password) throw new BadRequestException('Password PPPoE wajib diisi.');
    const pkg = await this.findPackage(dto.pppoePackageId);
    try {
      const account = await this.prisma.$transaction(async (tx) => {
        const item = await tx.pppoeAccount.create({ data: this.accountData(dto, this.secrets.encrypt(dto.password!), true), include: { package: { include: { ipPool: true } } } });
        if (dto.firstInvoice && dto.firstInvoice !== 'none') {
          await this.createFirstInvoice(tx, item, pkg, dto.discount || 0, dto.firstInvoice);
        }
        await this.radius.sync(tx, item);
        return item;
      });
      const { password: _password, ...safe } = account;
      return serialize({ message: 'Akun PPPoE berhasil ditambahkan dan disinkronkan ke RADIUS.', account: { ...safe, discount: Number(safe.discount) } });
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
          include: { package: { include: { ipPool: true } } },
        });
        await this.radius.sync(tx, item, current.username);
        return item;
      });
      const { password: _password, ...safe } = account;
      const warnings: string[] = [];
      if (!account.isActive || !account.package.isActive || current.username !== account.username) {
        warnings.push(...(await this.network.disconnect(current.username, current.routerNasId)).warnings);
      }
      const message = 'Akun PPPoE berhasil diperbarui dan disinkronkan ke RADIUS.';
      return serialize({ message: warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : message, warnings, account: { ...safe, discount: Number(safe.discount) } });
    } catch (error) { this.unique(error, 'Username PPPoE sudah digunakan.'); }
  }

  async removeAccount(id: string) {
    const current = await this.findAccount(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.radcheck.deleteMany({ where: { username: current.username } });
      await tx.radreply.deleteMany({ where: { username: current.username } });
      await tx.pppoeAccount.delete({ where: { id: current.id } });
    });
    const result = await this.network.disconnect(current.username, current.routerNasId);
    return { message: this.networkMessage('Akun PPPoE dan data RADIUS berhasil dihapus.', result.warnings), warnings: result.warnings };
  }

  async disconnectAccount(id: string) {
    const account = await this.findAccount(id);
    const result = await this.network.disconnect(account.username, account.routerNasId);
    return { ...result, message: this.networkMessage('Pemeriksaan dan pemutusan sesi selesai.', result.warnings) };
  }

  private accountData(dto: SaveAccountDto, password: string, creating: boolean) {
    const now = new Date();
    return {
      pppoePackageId: BigInt(dto.pppoePackageId), customerName: dto.customerName.trim(), username: dto.username.trim(), password,
      phone: dto.phone?.trim() || null, address: dto.address?.trim() || null,
      idCardNumber: dto.idCardNumber?.trim() || null,
      idCardPhoto: dto.idCardPhoto?.trim() || null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      subscriptionType: dto.subscriptionType || 'POSTPAID',
      billingDay: dto.billingDay ?? 1,
      discount: BigInt(dto.discount || 0),
      odp: dto.odp?.trim() || null,
      routerNasId: dto.routerNasId ? Number(dto.routerNasId) : null,
      expiresAt: dto.expiresAt ? new Date(`${dto.expiresAt}T00:00:00.000Z`) : null,
      isActive: creating ? true : dto.isActive ?? false, notes: dto.notes?.trim() || null,
      updatedAt: now, ...(creating ? { createdAt: now } : {}),
    };
  }

  private async createFirstInvoice(tx: Prisma.TransactionClient, account: Prisma.PppoeAccountGetPayload<{}>, packageData: Prisma.PppoePackageGetPayload<{}>, discount: number, firstInvoice: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    const bd = Math.min(Math.max(account.billingDay || 1, 1), 28);

    let nextBilling: Date;
    if (currentDay < bd) {
      nextBilling = new Date(year, month, bd);
    } else {
      nextBilling = new Date(year, month + 1, bd);
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysActive = Math.max(1, Math.ceil((nextBilling.getTime() - now.getTime()) / msPerDay));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const baseAmount = Math.max(0, Number(packageData.price) - discount);
    const prorate = firstInvoice === 'prorate' && account.subscriptionType !== 'PREPAID';
    const invoiceAmount = prorate ? Math.ceil((daysActive / daysInMonth) * baseAmount) : baseAmount;
    const dueDate = account.subscriptionType === 'PREPAID'
      ? account.expiresAt ?? new Date(now.getTime() + packageData.validityDays * msPerDay)
      : nextBilling;

    const invoiceNumber = this.generateInvoiceNumber();

    await tx.invoice.create({
      data: {
        pppoeAccountId: account.id,
        invoiceNumber,
        amount: BigInt(invoiceAmount),
        baseAmount: BigInt(baseAmount),
        discount: BigInt(discount),
        invoiceType: prorate ? 'PRORATE' : 'MONTHLY',
        status: 'PENDING',
        dueDate,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  private generateInvoiceNumber(): string {
    const now = new Date();
    return `INV-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Date.now().toString(36).toUpperCase()}`;
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
