import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { serialize } from '../common/serialize.js';
import { RadiusService } from './radius.service.js';
import { PppoeNetworkService } from './pppoe-network.service.js';
import { CreateAddonDto, CreatePromiseDto } from './customer-services.dto.js';

export function calendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new BadRequestException('Tanggal tidak valid.');
  return date;
}
export function promiseDeadline(value: string): Date {
  return new Date(calendarDate(value).getTime() + 17 * 3600000); // Pukul 00.00 hari berikutnya di Asia/Jakarta.
}
export function jakartaToday(): string { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }

@Injectable()
export class CustomerServicesService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private logger = new Logger(CustomerServicesService.name);
  constructor(private prisma: PrismaService, private radius: RadiusService, private network: PppoeNetworkService) {}
  onModuleInit() {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 60000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  private id(value: string) {
    if (!/^[1-9]\d{0,18}$/.test(value)) throw new BadRequestException('ID tidak valid.');
    return BigInt(value);
  }
  private async account(id: string, tx: Prisma.TransactionClient = this.prisma) {
    const account = await tx.pppoeAccount.findUnique({ where: { id: this.id(id) }, include: { package: { include: { ipPool: true } } } });
    if (!account) throw new NotFoundException('Pelanggan tidak ditemukan.');
    return account;
  }
  private async transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await this.prisma.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) throw error; }
    }
    throw new ConflictException('Data sedang diperbarui. Coba kembali.');
  }
  async authLogs(id: string) {
    const account = await this.account(id);
    return serialize({ data: await this.prisma.radpostauth.findMany({ where: { username: account.username },
      select: { id: true, reply: true, authdate: true }, orderBy: [{ authdate: 'desc' }, { id: 'desc' }], take: 10 }) });
  }
  async invoices(id: string) {
    const account = await this.account(id);
    const data = await this.prisma.invoice.findMany({ where: { pppoeAccountId: account.id }, orderBy: { id: 'desc' } });
    return serialize({ data: data.map(invoice => ({ ...invoice, status: invoice.status === 'PENDING' && invoice.dueDate < calendarDate(jakartaToday()) ? 'OVERDUE' : invoice.status })) });
  }
  async addons(id: string) {
    await this.account(id);
    return serialize({ data: await this.prisma.customerAddon.findMany({ where: { pppoeAccountId: this.id(id) }, orderBy: { id: 'desc' } }) });
  }
  async createAddon(id: string, dto: CreateAddonDto) {
    const dueDate = calendarDate(dto.dueDate);
    await this.transaction(async tx => {
      const account = await this.account(id, tx);
      const invoiceNumber = `ADD-${randomUUID()}`;
      await tx.invoice.create({ data: { pppoeAccountId: account.id, invoiceNumber, invoiceType: 'ADDON', amount: BigInt(dto.amount),
        baseAmount: BigInt(dto.amount), dueDate, notes: `${dto.name.trim()}${dto.notes ? `: ${dto.notes}` : ''}`, createdAt: new Date(), updatedAt: new Date() } });
      await tx.customerAddon.create({ data: { pppoeAccountId: account.id, name: dto.name.trim(), amount: BigInt(dto.amount), feeType: dto.feeType ?? 'ONCE', notes: dto.notes, invoiceNumber } });
    });
    return { message: 'Biaya tambahan dan tagihan berhasil dibuat.' };
  }
  async promises(id: string) {
    await this.account(id);
    return serialize({ data: await this.prisma.paymentPromise.findMany({ where: { pppoeAccountId: this.id(id) }, orderBy: { id: 'desc' } }) });
  }
  async createPromise(id: string, dto: CreatePromiseDto) {
    const promisedDate = calendarDate(dto.promisedDate);
    const deadline = promiseDeadline(dto.promisedDate);
    if (deadline.getTime() <= Date.now()) throw new BadRequestException('Tanggal janji bayar minimal hari ini.');
    if (deadline.getTime() / 1000 > 4294967295) throw new BadRequestException('Tanggal janji bayar di luar batas RADIUS.');
    await this.transaction(async tx => {
      const account = await this.account(id, tx);
      if (!account.package.isActive) throw new BadRequestException('Paket pelanggan tidak aktif. Aktifkan paket lebih dahulu.');
      if (await tx.paymentPromise.findFirst({ where: { pppoeAccountId: account.id, status: 'ACTIVE' } }))
        throw new BadRequestException('Masih ada janji bayar aktif.');
      const invoices = await tx.invoice.findMany({ where: { pppoeAccountId: account.id, status: { in: ['PENDING', 'OVERDUE'] } }, select: { id: true } });
      if (!invoices.length) throw new BadRequestException('Tidak ada tagihan yang belum dibayar.');
      await tx.paymentPromise.create({ data: { pppoeAccountId: account.id, promisedDate, deadline, notes: dto.notes, invoiceIds: invoices.map(i => String(i.id)), originalExpiresAt: account.expiresAt } });
      const active = await tx.pppoeAccount.update({ where: { id: account.id }, data: { isActive: true, updatedAt: new Date() }, include: { package: { include: { ipPool: true } } } });
      await this.radius.sync(tx, active);
    });
    return { message: 'Janji bayar dibuat. Akses dibuka sampai akhir tanggal janji (WIB).', isActive: true };
  }
  async payInvoice(id: string, invoiceId: string) {
    await this.transaction(async tx => {
      await this.account(id, tx);
      const invoice = await tx.invoice.findFirst({ where: { id: this.id(invoiceId), pppoeAccountId: this.id(id) } });
      if (!invoice) throw new NotFoundException('Tagihan tidak ditemukan.');
      if (invoice.status === 'PAID') return;
      if (!['PENDING', 'OVERDUE'].includes(invoice.status)) throw new BadRequestException('Tagihan tidak dapat dilunasi.');
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date(), updatedAt: new Date() } });
    });
    try { await this.reconcileAccount(this.id(id)); }
    catch (error) {
      this.logger.error(error);
      return { message: 'Pembayaran dicatat. Pembaruan akses janji bayar tertunda dan akan dicoba ulang otomatis.' };
    }
    return { message: 'Pembayaran tagihan dicatat.', isActive: (await this.account(id)).isActive };
  }
  async reconcileAccount(accountId: bigint) {
    await this.transaction(async tx => {
      const promise = await tx.paymentPromise.findFirst({ where: { pppoeAccountId: accountId, status: { in: ['ACTIVE', 'EXPIRED'] } }, orderBy: { id: 'desc' } });
      if (!promise) return;
      const account = await this.account(String(accountId), tx);
      const ids = (promise.invoiceIds as string[]).map(BigInt);
      const invoices = await tx.invoice.findMany({ where: { id: { in: ids }, pppoeAccountId: accountId }, select: { status: true } });
      const paid = invoices.length === ids.length && invoices.every(i => i.status === 'PAID');
      if (paid) {
        await tx.paymentPromise.update({ where: { id: promise.id }, data: { status: 'FULFILLED', disconnectPending: false } });
        // Akun yang dinonaktifkan manual tetap nonaktif; akses dari janji bayar kedaluwarsa dapat dipulihkan setelah pembayaran.
        const expiresAt = account.expiresAt && account.expiresAt.getTime() + 86400000 <= Date.now()
          ? new Date(Date.now() + account.package.validityDays * 86400000) : account.expiresAt;
        const active = await tx.pppoeAccount.update({ where: { id: account.id }, data: { isActive: account.isActive || promise.status === 'EXPIRED', expiresAt }, include: { package: { include: { ipPool: true } } } });
        await this.radius.sync(tx, active);
      } else if (promise.status === 'ACTIVE' && promise.deadline.getTime() <= Date.now()) {
        await tx.paymentPromise.update({ where: { id: promise.id }, data: { status: 'EXPIRED', disconnectPending: true } });
        const isolated = await tx.pppoeAccount.update({ where: { id: accountId }, data: { isActive: false }, include: { package: { include: { ipPool: true } } } });
        await this.radius.sync(tx, isolated);
      }
    });
    const pending = await this.prisma.paymentPromise.findFirst({ where: { pppoeAccountId: accountId, status: 'EXPIRED', disconnectPending: true } });
    if (pending) {
      const account = await this.account(String(accountId));
      if (account.isActive) return;
      const result = await this.network.disconnect(account.username, account.routerNasId);
      if (!result.warnings.length) await this.prisma.paymentPromise.update({ where: { id: pending.id }, data: { disconnectPending: false } });
      else this.logger.warn(result.warnings.join(' '));
    }
  }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const accounts = await this.prisma.paymentPromise.findMany({ where: { OR: [{ status: 'ACTIVE' }, { status: 'EXPIRED' }] }, select: { pppoeAccountId: true }, distinct: ['pppoeAccountId'] });
      for (const account of accounts) {
        try { await this.reconcileAccount(account.pppoeAccountId); }
        catch (error) { this.logger.error(`Janji bayar pelanggan ${account.pppoeAccountId}: ${error instanceof Error ? error.message : error}`); }
      }
    } catch (error) { this.logger.error(`Pemeriksaan janji bayar gagal. Pastikan migrasi customer-services diterapkan. ${error instanceof Error ? error.message : error}`); }
    finally { this.running = false; }
  }
}
