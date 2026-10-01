import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { pageMeta, serialize } from '../../common/serialize.js';
import { SaveAccountDto } from './data-pelanggan.dto.js';

import { RadiusService } from '../shared/radius.service.js';
import { SecretService } from '../shared/secret.service.js';
import { PppoeNetworkService } from '../shared/pppoe-network.service.js';
import { validateIdCardPhoto } from './id-card-photo.js';
import { readInstallationPhoto } from './installation-photo.js';
import { WhatsappNotifyService } from '../../bot-whatsapp/shared/whatsapp-notify.service.js';
import { localBillingDate, serviceInvoiceNumber } from './billing-cycle.js';
import { PengaturanService } from '../../tools/pengaturan/pengaturan.service.js';
import { removeCustomerImage } from '../../common/image-storage.js';

@Injectable()
export class DataPelangganService {
  private readonly logger = new Logger(DataPelangganService.name);

  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusService, private readonly secrets: SecretService, private readonly network: PppoeNetworkService, private readonly waNotify?: WhatsappNotifyService) { }

  private networkMessage(message: string, warnings: string[]) {
    return warnings.length ? `${message} Perhatian: ${warnings.join(' ')}` : `${message} Operasi MikroTik berhasil.`;
  }

  async nasOptions() {
    const data = await this.prisma.nas.findMany({ where: { isActive: true }, select: { id: true, nasname: true, shortname: true, description: true }, orderBy: { nasname: 'asc' } });
    return serialize({ data });
  }

  async odpOptions() {
    const nodes = await this.prisma.mainCore.findMany({ where: { tipeTitik: { in: ['server', 'rasio', 'odc', 'odp'] }, deletedAt: null }, select: { id: true, parentId: true, routerNasId: true, namaTitik: true, alamat: true, tipeTitik: true }, orderBy: { namaTitik: 'asc' } });
    const byId = new Map(nodes.map(node => [node.id.toString(), node]));
    const routers = await this.prisma.nas.findMany({ where: { isActive: true }, select: { id: true, nasname: true, shortname: true } });
    const routerById = new Map(routers.map(router => [router.id, router.shortname || router.nasname]));
    const data = nodes.filter(node => node.tipeTitik === 'odc' || node.tipeTitik === 'odp').map(node => {
      let current: typeof node | undefined = node;
      const visited = new Set<string>();
      let routerNasId: number | null = null;
      while (current && !visited.has(current.id.toString())) {
        visited.add(current.id.toString());
        if (current.tipeTitik === 'server') {
          routerNasId = current.routerNasId && routerById.has(current.routerNasId) ? current.routerNasId : null;
          break;
        }
        current = current.parentId ? byId.get(current.parentId.toString()) : undefined;
      }
      return { id: node.id, namaTitik: node.namaTitik, alamat: node.alamat, tipeTitik: node.tipeTitik, routerNasId, routerName: routerNasId ? routerById.get(routerNasId) : null };
    });
    return serialize({ data });
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
      this.prisma.pppoeAccount.findMany({ where, include: { paymentPromises: { where: { status: 'ACTIVE' }, select: { deadline: true }, take: 1 }, psbOrder: { select: { installationPhoto: true, completedAt: true } }, package: { include: { ipPool: true } }, routerNas: { select: { id: true, nasname: true, shortname: true, description: true } }, area: { select: { id: true, name: true } } }, omit: { password: true }, orderBy: { customerNumber: 'asc' }, ...(session ? {} : { skip: (page - 1) * 5, take: 5 }) }),
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

  async installationPhoto(id: string) {
    const account = await this.prisma.pppoeAccount.findUnique({
      where: { id: BigInt(id) },
      select: { psbOrder: { select: { installationPhoto: true } } },
    });
    if (!account) throw new NotFoundException('Pelanggan tidak ditemukan.');
    return readInstallationPhoto(account.psbOrder?.installationPhoto);
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
          address: account.address,
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
    await this.validateAccountForm(dto, false, current.id);
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
    const photos = new Set<string>();
    if (current.idCardPhoto) photos.add(current.idCardPhoto);
    await this.prisma.$transaction(async (tx) => {
      const orders = await tx.psbOrder.findMany({ where: { pppoeAccountId: current.id } });
      const snapshot = {
        id: current.id.toString(), customerNumber: current.customerNumber.toString(),
        customerName: current.customerName, username: current.username, deleted: true,
      };
      for (const order of orders) {
        if (order.idCardPhoto) photos.add(order.idCardPhoto);
        if (order.installationPhoto) photos.add(order.installationPhoto);
        for (const extension of ['jpg', 'png', 'webp']) photos.add(`/uploads/instalasi/${order.id}.${extension}`);
        if (order.installationFeePaid !== null && order.completedAt) {
          await tx.invoice.create({ data: {
            pppoeAccountId: current.id, invoiceNumber: `ARCHIVE-PSB-${order.id}`,
            amount: order.installationFeePaid, baseAmount: order.installationFeePaid,
            invoiceType: 'PSB', status: 'PAID', paidAt: order.completedAt, dueDate: order.completedAt,
            notes: `PSB diterima teknisi ID ${order.completedByUserId ?? '-'}`,
            createdAt: order.completedAt, updatedAt: new Date(),
          } });
        }
      }
      // Retain money already paid and every deposit (including pending review).
      await tx.invoice.deleteMany({ where: {
        pppoeAccountId: current.id, status: { not: 'PAID' }, paidAt: null, deposits: { none: {} },
      } });
      await tx.invoice.updateMany({ where: { pppoeAccountId: current.id }, data: { customerSnapshot: snapshot, pppoeAccountId: null } });
      await tx.collectorDeposit.updateMany({ where: { pppoeAccountId: current.id }, data: { customerSnapshot: snapshot, pppoeAccountId: null } });
      await tx.customerAddon.deleteMany({ where: { pppoeAccountId: current.id } });
      await tx.paymentPromise.deleteMany({ where: { pppoeAccountId: current.id } });
      await tx.activityLog.deleteMany({ where: { OR: [
        { entityType: 'PPPOE_ACCOUNT', entityId: current.id.toString() },
        { entityType: 'PSB_ORDER', entityId: { in: orders.map(order => order.id.toString()) } },
      ] } });
      const routes = [`/api/pppoe/accounts/${current.id}`, ...orders.map(order => `/api/psb/${order.id}`)];
      await tx.monitoringError.deleteMany({ where: { OR: routes.flatMap(route => [
        { route }, { route: { startsWith: `${route}/` } }, { route: { startsWith: `${route}?` } },
      ]) } });
      const phone = current.phone?.replace(/\D/g, '');
      if (phone) {
        const normalized = phone.startsWith('0') ? `62${phone.slice(1)}` : phone;
        const targets = [...new Set([current.phone!, phone, normalized, `+${normalized}`, ...(normalized.startsWith('62') ? [`0${normalized.slice(2)}`] : [])])];
        const sharedContacts = await tx.pppoeAccount.count({ where: { id: { not: current.id }, phone: { in: targets } } })
          + await tx.psbOrder.count({ where: { phone: { in: targets }, OR: [{ pppoeAccountId: null }, { pppoeAccountId: { not: current.id } }] } });
        if (!sharedContacts) {
          const tables = await tx.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bot_wa_logs'`;
          if (Number(tables[0]?.count)) await tx.$executeRaw(Prisma.sql`DELETE FROM bot_wa_logs WHERE target IN (${Prisma.join(targets)})`);
        }
      }
      await tx.psbOrder.deleteMany({ where: { pppoeAccountId: current.id } });
      await tx.radcheck.deleteMany({ where: { username: current.username } });
      await tx.radreply.deleteMany({ where: { username: current.username } });
      await tx.radusergroup.deleteMany({ where: { username: current.username } });
      await tx.radpostauth.deleteMany({ where: { username: current.username } });
      await tx.radacct.deleteMany({ where: { username: current.username } });
      await tx.pppoeAccount.delete({ where: { id: current.id } });
    });
    const warnings: string[] = [];
    try {
      const result = await this.network.disconnect(current.username, current.routerNasId);
      warnings.push(...result.warnings);
    } catch (error) {
      warnings.push(`Sesi router belum diputus: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const photo of photos) {
      if (photo.startsWith('data:')) continue;
      try {
        const references = await this.prisma.pppoeAccount.count({ where: { idCardPhoto: photo } })
          + await this.prisma.psbOrder.count({ where: { OR: [{ idCardPhoto: photo }, { installationPhoto: photo }] } });
        if (!references) await removeCustomerImage(photo);
      } catch (error) {
        warnings.push(`Foto ${photo} belum dihapus: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { message: this.networkMessage('Data pelanggan, PSB, log RADIUS, dan foto terkait dihapus. Riwayat pembayaran dipertahankan.', warnings), warnings };
  }

  async disconnectAccount(id: string) {
    const account = await this.findAccount(id);
    const result = await this.network.disconnect(account.username, account.routerNasId);
    return { ...result, message: this.networkMessage('Pemeriksaan dan pemutusan sesi selesai.', result.warnings) };
  }

  private async validateAccountForm(dto: SaveAccountDto, creating: boolean, accountId?: bigint) {
    for (const field of ['phone', 'idCardNumber'] as const) {
      const value = dto[field]?.trim();
      if (!value) continue;
      const order = await this.prisma.psbOrder.findFirst({
        where: { [field]: value, ...(accountId ? { OR: [{ pppoeAccountId: null }, { pppoeAccountId: { not: accountId } }] } : {}) },
        select: { id: true },
      });
      if (order) throw new ConflictException(`${field === 'phone' ? 'Nomor telepon' : 'Nomor KTP'} sudah digunakan pada registrasi pelanggan lain.`);
    }
    if (creating) {
      const fields = [dto.customerName, dto.phone, dto.idCardNumber, dto.idCardPhoto, dto.address];
      if (fields.some(value => !value?.trim())) {
        throw new BadRequestException('Seluruh data pelanggan, termasuk foto KTP, wajib diisi.');
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
    // Pascabayar diterbitkan scheduler pada bulan setelah mulai berlangganan.
    if (account.subscriptionType !== 'PREPAID') return;
    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const baseAmount = Math.max(0, Number(packageData.price) - discount);
    const dueDate = account.expiresAt ?? new Date(now.getTime() + packageData.validityDays * msPerDay);

    const settings = await new PengaturanService(this.prisma).billing();
    const period = localBillingDate(account.createdAt ?? now, settings.billingTimezone);
    const invoiceNumber = serviceInvoiceNumber(period.getUTCFullYear(), period.getUTCMonth() + 1, account.customerNumber);

    await tx.invoice.create({
      data: {
        pppoeAccountId: account.id,
        invoiceNumber,
        amount: BigInt(baseAmount),
        baseAmount: BigInt(baseAmount),
        discount: BigInt(discount),
        invoiceType: 'MONTHLY',
        status: 'PENDING',
        dueDate,
        createdAt: now,
        updatedAt: now,
      },
    });
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
    if (!item) throw new NotFoundException('Harga paket tidak ditemukan.');
    return item;
  }
  private async findAccount(id: string) {
    const item = await this.prisma.pppoeAccount.findUnique({ where: { id: BigInt(id) } });
    if (!item) throw new NotFoundException('Akun PPPoE tidak ditemukan.');
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
