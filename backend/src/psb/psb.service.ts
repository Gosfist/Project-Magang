import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { RadiusService } from '../pppoe/radius.service.js';
import { SecretService } from '../pppoe/secret.service.js';
import { WhatsappNotifyService } from '../pppoe/whatsapp-notify.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { firstBillingCycle } from '../pppoe/billing-cycle.js';
import { ActivatePsbOrderDto, CreatePsbOrderDto, UpdatePsbOrderDto } from './psb.dto.js';

@Injectable()
export class PsbService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly radius: RadiusService,
    private readonly secrets: SecretService,
    private readonly settings: SettingsService,
    private readonly wa: WhatsappNotifyService,
  ) {}

  async list(user: { id: string; role: string }, search = '', status = '', page = 1) {
    const where: Prisma.PsbOrderWhereInput = {
      ...(user.role === 'sales' ? { salesUserId: BigInt(user.id) } : {}),
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ customerName: { contains: search } }, { phone: { contains: search } }] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.psbOrder.findMany({
        where,
        include: { package: true, area: true, sales: { select: { id: true, name: true } }, activatedBy: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 10,
        take: 10,
      }),
      this.prisma.psbOrder.count({ where }),
    ]);
    return serialize({ data: data.map(item => ({ ...item, customerId: this.customerId(item.customerNumber), package: { ...item.package, price: Number(item.package.price), costPrice: Number(item.package.costPrice) }, password: undefined })), meta: pageMeta(page, 10, total) });
  }

  async create(dto: CreatePsbOrderDto, salesUserId: string) {
    await this.validateCustomer(dto);
    const order = await this.serializable(async tx => {
      const [accountMax, orderMax] = await Promise.all([
        tx.pppoeAccount.aggregate({ _max: { customerNumber: true } }),
        tx.psbOrder.aggregate({ _max: { customerNumber: true } }),
      ]);
      const customerNumber = (accountMax._max.customerNumber ?? 0n) > (orderMax._max.customerNumber ?? 0n)
        ? (accountMax._max.customerNumber ?? 0n) + 1n : (orderMax._max.customerNumber ?? 0n) + 1n;
      return tx.psbOrder.create({ data: { ...this.customerData(dto), customerNumber, salesUserId: BigInt(salesUserId) }, include: { package: true } });
    });
    void this.wa.notifySalesRegistration({ customerName: order.customerName, customerNumber: order.customerNumber, phone: order.phone, address: order.address, packageName: order.package.name });
    return serialize({ message: 'Registrasi pelanggan berhasil dan masuk ke antrean teknisi.', order: { ...order, customerId: this.customerId(order.customerNumber), password: undefined } });
  }

  async update(id: string, dto: UpdatePsbOrderDto, user: { id: string; role: string }) {
    const current = await this.find(id);
    this.assertSalesOwner(current, user);
    if (current.status !== 'PROCESS') throw new BadRequestException('Data yang sudah diaktivasi tidak dapat diedit oleh sales.');
    await this.validateCustomer(dto, current.id);
    const order = await this.prisma.psbOrder.update({ where: { id: current.id }, data: this.customerData(dto) });
    return serialize({ message: 'Registrasi pelanggan berhasil diperbarui.', order });
  }

  async remove(id: string, user: { id: string; role: string }) {
    const current = await this.find(id);
    this.assertSalesOwner(current, user);
    if (current.status !== 'PROCESS') throw new BadRequestException('Data yang sudah diaktivasi tidak dapat dihapus.');
    await this.prisma.psbOrder.delete({ where: { id: current.id } });
    return { message: 'Registrasi pelanggan berhasil dihapus.' };
  }

  async activate(id: string, dto: ActivatePsbOrderDto, technicianId: string) {
    const order = await this.find(id, true);
    if (dto.installationPhoto.length > 8_000_000) throw new BadRequestException('Foto instalasi maksimal sekitar 5 MB.');
    const odp = await this.prisma.mainCore.findFirst({ where: { id: BigInt(dto.odp), tipeTitik: { in: ['odc', 'odp'] } } });
    if (!odp) throw new BadRequestException('ODC / ODP tidak ditemukan.');
    if (order.status !== 'PROCESS') {
      if (!order.pppoeAccountId || !['ACTIVATED', 'COMPLETED'].includes(order.status)) {
        throw new BadRequestException('Pesanan ini tidak dapat diedit.');
      }
      const updated = await this.prisma.$transaction(async tx => {
        const account = await tx.pppoeAccount.update({
          where: { id: order.pppoeAccountId! },
          data: { odp: dto.odp, routerNasId: dto.routerNasId ? Number(dto.routerNasId) : null },
          include: { package: { include: { ipPool: true } } },
        });
        await this.radius.sync(tx, account);
        return tx.psbOrder.update({
          where: { id: order.id },
          data: { odp: dto.odp, routerNasId: dto.routerNasId ? Number(dto.routerNasId) : null, installationPhoto: dto.installationPhoto },
        });
      });
      return serialize({ message: 'Data aktivasi berhasil diperbarui.', order: updated });
    }
    try {
      const result = await this.prisma.$transaction(async tx => {
        const account = await tx.pppoeAccount.create({
          data: {
            customerNumber: order.customerNumber,
            pppoePackageId: order.pppoePackageId,
            customerName: order.customerName,
            idCardNumber: order.idCardNumber,
            idCardPhoto: order.idCardPhoto,
            username: dto.username.trim(),
            password: this.secrets.encrypt(dto.password),
            phone: order.phone,
            address: order.address,
            subscriptionType: 'POSTPAID',
            billingDay: 1,
            discount: 0n,
            odp: dto.odp,
            routerNasId: dto.routerNasId ? Number(dto.routerNasId) : null,
            areaId: order.areaId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          include: { package: { include: { ipPool: true } } },
        });
        await this.radius.sync(tx, account);
        const updated = await tx.psbOrder.update({
          where: { id: order.id },
          data: { status: 'ACTIVATED', username: dto.username.trim(), password: this.secrets.encrypt(dto.password), odp: dto.odp, routerNasId: dto.routerNasId ? Number(dto.routerNasId) : null, installationPhoto: dto.installationPhoto, pppoeAccountId: account.id, activatedByUserId: BigInt(technicianId), activatedAt: new Date() },
        });
        return { account, updated };
      });
      return serialize({ message: 'Akun PPPoE dan bukti instalasi berhasil disimpan.', order: result.updated, credentials: { username: dto.username, password: dto.password } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = String(error.meta?.target ?? '');
        throw new ConflictException(/phone/.test(target) ? 'Nomor telepon sudah digunakan pelanggan lain.' : /id_card_number|idCardNumber/.test(target) ? 'Nomor KTP sudah digunakan pelanggan lain.' : 'Username PPPoE sudah digunakan.');
      }
      throw error;
    }
  }

  async complete(id: string, technicianId: string) {
    const order = await this.find(id, true);
    if (order.status !== 'ACTIVATED' || !order.pppoeAccountId) throw new BadRequestException('Aktivasi PPPoE dan foto instalasi harus disimpan lebih dahulu.');
    const billing = await this.settings.billing();
    const psb = await this.settings.psb();
    const now = new Date();
    const first = firstBillingCycle(order.activatedAt ?? now, Number(order.package.price), billing.billingEndDay, billing.billingTimezone);
    const nextMonth = first.dueDate;
    const serviceAmount = first.amount;
    const total = serviceAmount + psb.installationFee;
    await this.prisma.$transaction(async tx => {
      await tx.psbOrder.update({ where: { id: order.id }, data: { status: 'COMPLETED', completedByUserId: BigInt(technicianId), completedAt: now } });
      await tx.invoice.create({ data: { pppoeAccountId: order.pppoeAccountId!, invoiceNumber: `PSB-${this.customerId(order.customerNumber)}-${Date.now().toString(36).toUpperCase()}`, amount: BigInt(total), baseAmount: BigInt(total), discount: 0n, invoiceType: 'PRORATE', status: 'PENDING', dueDate: nextMonth, notes: `Aktivasi pasang baru (layanan prorata Rp${serviceAmount.toLocaleString('id-ID')} + biaya PSB Rp${psb.installationFee.toLocaleString('id-ID')})`, createdAt: now, updatedAt: now } });
    });
    void this.wa.notifyPsbCompleted({ customerName: order.customerName, customerNumber: order.customerNumber, phone: order.phone, packageName: order.package.name, installationFee: psb.installationFee, billingStartDay: billing.billingStartDay, billingEndDay: billing.billingEndDay, prorateAmount: serviceAmount, firstDueDate: nextMonth });
    return { message: 'Pemasangan selesai. Status Sales dan Teknisi telah diperbarui serta notifikasi pelanggan diproses.' };
  }

  private customerData(dto: CreatePsbOrderDto) {
    return { customerName: dto.customerName.trim(), phone: dto.phone.trim(), idCardNumber: dto.idCardNumber?.trim() || null, idCardPhoto: dto.idCardPhoto || null, address: dto.address.trim(), pppoePackageId: BigInt(dto.pppoePackageId), areaId: dto.areaId ? BigInt(dto.areaId) : null };
  }
  private async validateCustomer(dto: CreatePsbOrderDto, excludeId?: bigint) {
    for (const field of ['phone', 'idCardNumber'] as const) {
      const value = dto[field]?.trim();
      if (!value) continue;
      const existingOrder = await this.prisma.psbOrder.findFirst({ where: { [field]: value, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
      const existingAccount = await this.prisma.pppoeAccount.findFirst({ where: { [field]: value }, select: { id: true } });
      if (existingOrder || existingAccount) throw new ConflictException(`${field === 'phone' ? 'Nomor telepon' : 'Nomor KTP'} sudah digunakan pelanggan lain.`);
    }
    if (!await this.prisma.pppoePackage.findUnique({ where: { id: BigInt(dto.pppoePackageId) } })) throw new NotFoundException('Harga paket tidak ditemukan.');
    if (dto.areaId && !await this.prisma.area.findUnique({ where: { id: BigInt(dto.areaId) } })) throw new NotFoundException('Area tidak ditemukan.');
  }
  private async find(id: string, includePackage = false): Promise<any> {
    const order = await this.prisma.psbOrder.findUnique({ where: { id: BigInt(id) }, ...(includePackage ? { include: { package: true } } : {}) });
    if (!order) throw new NotFoundException('Registrasi pasang baru tidak ditemukan.');
    return order;
  }
  private assertSalesOwner(order: { salesUserId: bigint }, user: { id: string; role: string }) {
    if (user.role !== 'admin' && order.salesUserId !== BigInt(user.id)) throw new BadRequestException('Registrasi ini bukan milik Sales Anda.');
  }
  private customerId(value: bigint) { return value.toString().padStart(6, '0'); }
  private async serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let i = 0; i < 4; i++) {
      try { return await this.prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = String(error.meta?.target ?? '');
          if (/phone|id_card_number|idCardNumber/.test(target)) throw new ConflictException(/phone/.test(target) ? 'Nomor telepon sudah digunakan pelanggan lain.' : 'Nomor KTP sudah digunakan pelanggan lain.');
        }
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code) || i === 3) throw error;
      }
    }
    throw new ConflictException('Nomor pelanggan belum dapat dibuat.');
  }
}
