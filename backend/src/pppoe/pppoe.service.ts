import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { SaveAccountDto, SavePackageDto } from './pppoe.dto.js';
import { SaveIpPoolDto } from './ip-pool.dto.js';
import { RadiusService } from './radius.service.js';
import { SecretService } from './secret.service.js';
import { PppoeNetworkService } from './pppoe-network.service.js';
import { validateIdCardPhoto } from './id-card-photo.js';
import { WhatsappNotifyService } from './whatsapp-notify.service.js';

@Injectable()
export class PppoeService {
  private readonly logger = new Logger(PppoeService.name);

  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusService, private readonly secrets: SecretService, private readonly network: PppoeNetworkService, private readonly waNotify?: WhatsappNotifyService) { }

  async ipPools(search = '', page = 1) {
    const result = await this.network.listPools();
    const items = result.data.filter((pool) => `${pool.name} ${pool.routerName}`.toLowerCase().includes(search.toLowerCase()));
    return { data: items.slice((page - 1) * 10, page * 10), meta: pageMeta(page, 10, items.length), warnings: result.warnings };
  }

  async ipPoolOptions() { return this.network.listPools(); }

  async createIpPool(dto: SaveIpPoolDto) {
    this.validatePoolRange(dto);
    await this.network.poolRouter(dto.routerNasId, async (write) => {
      const rows = await write('/ip/pool/print', [`?name=${dto.name}`, '=.proplist=.id,name']);
      if (rows.some((row) => row.name === dto.name)) throw new BadRequestException('Nama pool sudah digunakan di MikroTik ini.');
      await write('/ip/pool/add', [`=name=${dto.name}`, `=ranges=${dto.networkStart}-${dto.networkEnd}`, '=comment=UNZANET PPPoE']);
    });
    return { message: 'IP Pool berhasil dibuat langsung di MikroTik.' };
  }

  async updateIpPool(id: string, dto: SaveIpPoolDto) {
    this.validatePoolRange(dto);
    const identity = this.network.poolIdentity(id);
    if (identity.routerNasId !== dto.routerNasId) throw new BadRequestException('Router pool tidak dapat dipindahkan.');
    await this.network.poolRouter(identity.routerNasId, async (write) => {
      const rows = await write('/ip/pool/print', [`?.id=${identity.routerId}`, '=.proplist=.id,name']);
      const pool = rows.find((row) => row['.id'] === identity.routerId);
      if (!pool) throw new NotFoundException('IP Pool tidak ditemukan di MikroTik.');
      if (pool.name !== dto.name) await this.assertPoolUnused(pool.name);
      await write('/ip/pool/set', [`=.id=${identity.routerId}`, `=name=${dto.name}`, `=ranges=${dto.networkStart}-${dto.networkEnd}`]);
    });
    return { message: 'IP Pool berhasil diperbarui di MikroTik.' };
  }

  private async assertPoolUnused(name: string) {
    if (await this.prisma.pppoePackage.count({ where: { OR: [{ addressPool: name }, { ipPool: { name } }] } })) {
      throw new BadRequestException('IP Pool masih digunakan paket PPPoE. Pindahkan paket sebelum mengganti nama atau menghapus pool.');
    }
  }

  private validatePoolRange(dto: SaveIpPoolDto) {
    const numeric = (ip: string) => ip.split('.').reduce((value, octet) => value * 256 + Number(octet), 0);
    if (numeric(dto.networkStart) > numeric(dto.networkEnd)) throw new BadRequestException('Awal rentang IP harus lebih kecil atau sama dengan akhir rentang IP.');
  }

  private networkMessage(message: string, warnings: string[]) {
    return warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : `${message} Operasi MikroTik berhasil.`;
  }

  async removeIpPool(id: string) {
    const identity = this.network.poolIdentity(id);
    await this.network.poolRouter(identity.routerNasId, async (write) => {
      const rows = await write('/ip/pool/print', [`?.id=${identity.routerId}`, '=.proplist=.id,name']);
      const pool = rows.find((row) => row['.id'] === identity.routerId);
      if (!pool) throw new NotFoundException('IP Pool tidak ditemukan di MikroTik.');
      await this.assertPoolUnused(pool.name);
      await write('/ip/pool/remove', [`=.id=${identity.routerId}`]);
    });
    return { message: 'IP Pool berhasil dihapus dari MikroTik.' };
  }

  async nasOptions() {
    const data = await this.prisma.nas.findMany({ select: { id: true, nasname: true, shortname: true, description: true }, orderBy: { nasname: 'asc' } });
    return serialize({ data });
  }

  async odpOptions() {
    const data = await this.prisma.mainCore.findMany({ where: { tipeTitik: { in: ['odc', 'odp'] } }, select: { id: true, namaTitik: true, alamat: true, tipeTitik: true }, orderBy: { namaTitik: 'asc' } });
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
          ipPoolId: null,
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

  async accounts(search = '', page = 1, status = '', session = '') {
    if (!['', 'active', 'isolated'].includes(status) || !['', 'online', 'offline'].includes(session)) throw new BadRequestException('Filter status atau sesi tidak valid.');
    const where: Prisma.PppoeAccountWhereInput = search ? { OR: [{ customerName: { contains: search } }, { username: { contains: search } }, { phone: { contains: search } }, ...(search.startsWith('62') ? [{ phone: { contains: `0${search.slice(2)}` } }] : []), ...(/^\d{1,18}$/.test(search) ? [{ customerNumber: BigInt(search) }] : [])] } : {};
    const active: Prisma.PppoeAccountWhereInput = { isActive: true, package: { isActive: true }, OR: [
      { paymentPromises: { some: { status: 'ACTIVE', deadline: { gt: new Date() } } } },
      { paymentPromises: { none: { status: 'ACTIVE' } }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date(Date.now() - 86400000) } }] },
    ] };
    if (status) where.AND = [status === 'active' ? active : { NOT: active }];
    const [items, count] = await this.prisma.$transaction([
      this.prisma.pppoeAccount.findMany({ where, include: { paymentPromises: { where: { status: 'ACTIVE' }, select: { deadline: true }, take: 1 }, package: { include: { ipPool: true } }, routerNas: { select: { id: true, nasname: true, shortname: true, description: true } }, area: { select: { id: true, name: true } } }, omit: { password: true }, orderBy: { customerNumber: 'asc' }, ...(session ? {} : { skip: (page - 1) * 5, take: 5 }) }),
      this.prisma.pppoeAccount.count({ where }),
    ]);
    const presence = await this.network.accountPresence(items);
    const filtered = session ? items.filter(item => presence.states.get(item.username) === (session === 'online')) : items;
    const total = session ? filtered.length : count;
    const visible = session ? filtered.slice((page - 1) * 5, page * 5) : filtered;
    return serialize({ data: visible.map((item) => ({ ...item, customerId: item.customerNumber.toString().padStart(6, '0'), online: presence.states.get(item.username) ?? null,
      uptime: presence.uptimes?.get(item.username) ?? null,
      serviceStatus: item.isActive && item.package.isActive && (item.paymentPromises.length ? item.paymentPromises[0].deadline.getTime() > Date.now() : !item.expiresAt || item.expiresAt.getTime() + 86400000 > Date.now()) ? 'Aktif' : 'Isolir',
      discount: Number(item.discount), package: { ...item.package, price: Number(item.package.price), costPrice: Number(item.package.costPrice) } })), meta: pageMeta(page, 5, total), warnings: presence.warnings });
  }

  async createAccount(dto: SaveAccountDto) {
    if (!dto.password) throw new BadRequestException('Kata sandi PPPoE wajib diisi.');
    await this.validateAccountForm(dto, true);
    const pkg = await this.findPackage(dto.pppoePackageId);
    try {
      const account = await this.createAccountTransaction(async (tx) => {
        const maximum = await tx.pppoeAccount.aggregate({ _max: { customerNumber: true } });
        const customerNumber = (maximum._max.customerNumber ?? 0n) + 1n;
        const item = await tx.pppoeAccount.create({ data: { ...this.accountData(dto, this.secrets.encrypt(dto.password!), true), customerNumber }, include: { package: { include: { ipPool: true } } } });
        await this.closeOpenAccounting(tx, item.username);
        if (dto.firstInvoice && dto.firstInvoice !== 'none') {
          await this.createFirstInvoice(tx, item, pkg, dto.discount || 0, dto.firstInvoice);
        }
        await this.radius.sync(tx, item);
        return item;
      });

      // Fire-and-forget WA notification
      if (this.waNotify) {
        this.waNotify.notifyRegistration({
          customerName: account.customerName,
          customerNumber: account.customerNumber,
          phone: account.phone,
          username: account.username,
          password: dto.password!,
          package: { name: account.package.name },
        }).catch((err) => {
          this.logger.warn(`Notifikasi WA registrasi error: ${err?.message || err}`);
        });
      }

      const { password: _password, ...safe } = account;
      return serialize({ message: `Akun PPPoE pelanggan ${account.customerName} berhasil ditambahkan.`, account: { ...safe, discount: Number(safe.discount) } });
    } catch (error) { this.unique(error, 'Nama pengguna PPPoE sudah digunakan.'); }
  }

  async updateAccount(id: string, dto: SaveAccountDto) {
    const current = await this.findAccount(id);
    const passwordChanged = dto.password ? dto.password !== this.secrets.decrypt(current.password) : false;
    await this.validateAccountForm(dto, false);
    if (dto.idCardPhoto && dto.idCardPhoto !== current.idCardPhoto) await validateIdCardPhoto(dto.idCardPhoto);
    await this.findPackage(dto.pppoePackageId);
    try {
      const account = await this.prisma.$transaction(async (tx) => {
        if (dto.isActive === false) await tx.paymentPromise.updateMany({ where: { pppoeAccountId: current.id, status: { in: ['ACTIVE', 'EXPIRED'] } }, data: { status: 'CANCELLED', disconnectPending: false } });
        const item = await tx.pppoeAccount.update({
          where: { id: current.id },
          data: this.accountData(dto, dto.password ? this.secrets.encrypt(dto.password) : current.password, false),
          include: { package: { include: { ipPool: true } } },
        });
        if (current.username !== item.username || passwordChanged) {
          await this.closeOpenAccounting(tx, current.username);
          await this.closeOpenAccounting(tx, item.username);
        }
        await this.radius.sync(tx, item, current.username);
        return item;
      });
      const { password: _password, ...safe } = account;
      const warnings: string[] = [];
      if (!account.isActive || !account.package.isActive || current.username !== account.username || passwordChanged) {
        warnings.push(...(await this.network.disconnect(current.username, current.routerNasId)).warnings);
      }
      if (current.isActive && !account.isActive && this.waNotify) {
        const pendingInvoices = await this.prisma.invoice.findMany({
          where: { pppoeAccountId: account.id, status: { in: ['PENDING', 'OVERDUE'] } },
          select: { amount: true, dueDate: true },
          orderBy: { dueDate: 'asc' },
        });
        await this.waNotify.notifyIsolation({
          customerName: account.customerName,
          customerNumber: account.customerNumber,
          phone: account.phone,
          packageName: account.package.name,
          totalAmount: pendingInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0),
          dueDate: this.formatDate(pendingInvoices[0]?.dueDate),
        });
      }
      const message = 'Akun PPPoE berhasil diperbarui dan disinkronkan ke RADIUS.';
      return serialize({ message: warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : message, warnings, account: { ...safe, discount: Number(safe.discount) } });
    } catch (error) { this.unique(error, 'Nama pengguna PPPoE sudah digunakan.'); }
  }

  private async createAccountTransaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { return await this.prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        const retry = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034'
          || (error.code === 'P2002' && /customer_number|customerNumber/.test(String(error.meta?.target))));
        if (!retry) throw error;
        if (attempt === 4) throw new ConflictException('Nomor pelanggan sedang digunakan proses lain. Coba simpan kembali.');
      }
    }
    throw new ConflictException('Nomor pelanggan belum dapat dibuat.');
  }

  async removeAccount(id: string) {
    const current = await this.findAccount(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.radcheck.deleteMany({ where: { username: current.username } });
      await tx.radreply.deleteMany({ where: { username: current.username } });
      await this.closeOpenAccounting(tx, current.username);
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

  private async validateAccountForm(dto: SaveAccountDto, creating: boolean) {
    if (creating) {
      const fields = [dto.customerName, dto.phone, dto.idCardNumber, dto.idCardPhoto, dto.address];
      if (fields.some(value => !value?.trim()) || dto.latitude == null
        || !Number.isFinite(dto.latitude)) {
        throw new BadRequestException('Seluruh data pelanggan, termasuk foto KTP dan koordinat, wajib diisi.');
      }
      await validateIdCardPhoto(dto.idCardPhoto!);
    }
    if (!dto.odp || !/^[1-9]\d*$/.test(dto.odp)) throw new BadRequestException('ODC / ODP wajib dipilih.');
    const odp = await this.prisma.mainCore.findFirst({ where: { id: BigInt(dto.odp), tipeTitik: { in: ['odc', 'odp'] } }, select: { id: true } });
    if (!odp) throw new BadRequestException('ODC / ODP tidak ditemukan. Pilih yang tersedia.');
  }

  private accountData(dto: SaveAccountDto, password: string, creating: boolean) {
    const now = new Date();
    return {
      pppoePackageId: BigInt(dto.pppoePackageId), customerName: dto.customerName.trim(), username: dto.username.trim(), password,
      phone: dto.phone?.trim() || null, address: dto.address?.trim() || null,
      idCardNumber: dto.idCardNumber?.trim() || null,
      idCardPhoto: dto.idCardPhoto?.trim() || null,
      latitude: dto.latitude ?? null,
      subscriptionType: dto.subscriptionType || 'POSTPAID',
      billingDay: dto.billingDay ?? 1,
      discount: BigInt(dto.discount || 0),
      odp: dto.odp?.trim() || null,
      routerNasId: dto.routerNasId ? Number(dto.routerNasId) : null,
      areaId: dto.areaId ? BigInt(dto.areaId) : null,
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

  private closeOpenAccounting(tx: Prisma.TransactionClient, username: string) {
    return tx.radacct.updateMany({
      where: { username, acctstoptime: null },
      data: { acctstoptime: new Date(), acctterminatecause: 'Admin-Reset' },
    });
  }

  private formatDate(date?: Date) {
    if (!date) return undefined;
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(date);
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
