import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { WhatsappNotifyService } from '../pppoe/whatsapp-notify.service.js';
import { CreateDepositDto, RejectDepositDto } from './deposit.dto.js';

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waNotify?: WhatsappNotifyService,
  ) {}

  async list(
    status = '',
    collectorId = '',
    startDate = '',
    endDate = '',
    search = '',
    page = 1,
    perPage = 15,
  ) {
    const where: Prisma.CollectorDepositWhereInput = {};

    if (status && ['PENDING', 'ACCEPTED', 'REJECTED'].includes(status)) {
      where.status = status;
    }
    if (collectorId) {
      where.collectorUserId = BigInt(collectorId);
    }
    if (startDate || endDate) {
      where.depositDate = {};
      if (startDate) where.depositDate.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.depositDate.lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    if (search) {
      where.account = {
        OR: [
          { customerName: { contains: search } },
          { username: { contains: search } },
        ],
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.collectorDeposit.findMany({
        where,
        include: {
          account: {
            select: {
              id: true, customerNumber: true, customerName: true, phone: true, username: true,
              area: { select: { id: true, name: true } },
            },
          },
          invoice: {
            select: { id: true, invoiceNumber: true, amount: true, dueDate: true, status: true },
          },
          collector: { select: { id: true, name: true, phone: true } },
          acceptedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.collectorDeposit.count({ where }),
    ]);

    return serialize({
      data: data.map((d) => ({
        ...d,
        amount: Number(d.amount),
        invoice: d.invoice ? { ...d.invoice, amount: Number(d.invoice.amount) } : null,
      })),
      meta: pageMeta(page, perPage, total),
    });
  }

  async unpaidInvoices(search = '') {
    const where: Prisma.InvoiceWhereInput = {
      status: { in: ['PENDING', 'OVERDUE'] },
      deposits: {
        none: {
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      },
    };

    if (search) {
      const orConditions: Prisma.InvoiceWhereInput[] = [
        { invoiceNumber: { contains: search } },
        { account: { customerName: { contains: search } } },
        { account: { username: { contains: search } } },
      ];
      if (/^\d+$/.test(search)) {
        try {
          orConditions.push({ account: { customerNumber: BigInt(search) } });
        } catch {
          // ignore invalid bigint
        }
      }
      where.OR = orConditions;
    }

    const data = await this.prisma.invoice.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            customerNumber: true,
            customerName: true,
            phone: true,
            username: true,
            area: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
      take: 25,
    });

    return serialize({
      data: data.map((inv) => ({
        ...inv,
        amount: Number(inv.amount),
        baseAmount: Number(inv.baseAmount),
        discount: Number(inv.discount),
      })),
    });
  }

  async create(dto: CreateDepositDto, collectorUserId: string) {
    // Validate account and invoice exist
    const account = await this.prisma.pppoeAccount.findUnique({
      where: { id: BigInt(dto.pppoeAccountId) },
      include: { area: true },
    });
    if (!account) throw new NotFoundException('Pelanggan tidak ditemukan.');

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: BigInt(dto.invoiceId), pppoeAccountId: account.id },
    });
    if (!invoice) throw new NotFoundException('Tagihan tidak ditemukan.');
    if (invoice.status === 'PAID') throw new BadRequestException('Tagihan sudah lunas.');
    if (!['PENDING', 'OVERDUE'].includes(invoice.status)) throw new BadRequestException('Tagihan tidak dapat dibayar.');

    // Check duplicate deposit for same invoice
    const existing = await this.prisma.collectorDeposit.findFirst({
      where: { invoiceId: invoice.id, status: { in: ['PENDING', 'ACCEPTED'] } },
    });
    if (existing) throw new BadRequestException('Sudah ada setoran untuk tagihan ini yang masih pending atau sudah diterima.');

    const collector = await this.prisma.user.findUnique({
      where: { id: BigInt(collectorUserId) },
      select: { id: true, name: true },
    });

    const deposit = await this.prisma.collectorDeposit.create({
      data: {
        pppoeAccountId: account.id,
        invoiceId: invoice.id,
        collectorUserId: BigInt(collectorUserId),
        amount: BigInt(dto.amount),
        depositDate: new Date(`${dto.depositDate}T00:00:00.000Z`),
        notes: dto.notes?.trim() || null,
      },
    });

    // Send WA notification: deposit to collector
    if (this.waNotify && account.phone) {
      this.waNotify.notifyDepositToCollector({
        customerName: account.customerName,
        customerNumber: account.customerNumber,
        phone: account.phone,
        amount: dto.amount,
        depositDate: dto.depositDate,
        collectorName: collector?.name || 'Kolektor',
        areaName: account.area?.name || '-',
      }).catch((err) => {
        this.logger.warn(`Notifikasi WA setoran error: ${err?.message || err}`);
      });
    }

    return serialize({ message: 'Setoran berhasil dicatat. Menunggu konfirmasi dari tim keuangan.', deposit: { ...deposit, amount: Number(deposit.amount) } });
  }

  async accept(id: string, acceptedByUserId: string) {
    const deposit = await this.findDeposit(id);
    if (deposit.status !== 'PENDING') throw new BadRequestException('Hanya setoran dengan status pending yang dapat di-ACC.');

    // Transaction: accept deposit + pay invoice + create finance transaction
    await this.prisma.$transaction(async (tx) => {
      // Accept the deposit
      await tx.collectorDeposit.update({
        where: { id: deposit.id },
        data: { status: 'ACCEPTED', acceptedByUserId: BigInt(acceptedByUserId), acceptedAt: new Date() },
      });

      // Pay the invoice
      await tx.invoice.update({
        where: { id: deposit.invoiceId },
        data: { status: 'PAID', paidAt: new Date(), updatedAt: new Date() },
      });

      // Create income transaction
      await tx.financeTransaction.create({
        data: {
          type: 'INCOME',
          category: 'SETORAN_KOLEKTOR',
          amount: deposit.amount,
          description: `Setoran dari kolektor ${deposit.collector.name} untuk pelanggan ${deposit.account.customerName}`,
          referenceType: 'DEPOSIT',
          referenceId: deposit.id,
          createdByUserId: BigInt(acceptedByUserId),
          transactionDate: new Date(),
        },
      });
    });

    // Reconcile account (activate if all invoices paid)
    try {
      await this.reconcileAfterPayment(deposit.pppoeAccountId);
    } catch (err) {
      this.logger.error(`Reconcile error after deposit accept: ${err}`);
    }

    // Send WA notification: deposit accepted by company
    const account = await this.prisma.pppoeAccount.findUnique({
      where: { id: deposit.pppoeAccountId },
      select: { customerName: true, customerNumber: true, phone: true },
    });

    if (this.waNotify && account?.phone) {
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: deposit.invoiceId },
        select: { dueDate: true },
      });
      this.waNotify.notifyDepositAccepted({
        customerName: account.customerName,
        customerNumber: account.customerNumber,
        phone: account.phone,
        amount: Number(deposit.amount),
        acceptedDate: new Date().toISOString().slice(0, 10),
        billingMonth: invoice?.dueDate
          ? new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(invoice.dueDate)
          : '-',
      }).catch((err) => {
        this.logger.warn(`Notifikasi WA setoran diterima error: ${err?.message || err}`);
      });
    }

    return { message: 'Setoran berhasil di-ACC. Tagihan dilunasi dan transaksi pemasukan tercatat.' };
  }

  async reject(id: string, dto: RejectDepositDto) {
    const deposit = await this.findDeposit(id);
    if (deposit.status !== 'PENDING') throw new BadRequestException('Hanya setoran dengan status pending yang dapat ditolak.');

    await this.prisma.collectorDeposit.update({
      where: { id: deposit.id },
      data: { status: 'REJECTED', notes: dto.reason ? `Ditolak: ${dto.reason}` : 'Ditolak oleh bagian keuangan.' },
    });

    return { message: 'Setoran ditolak.' };
  }

  private async reconcileAfterPayment(accountId: bigint) {
    // Check if all pending invoices are paid; if so, reactivate account
    const pendingInvoices = await this.prisma.invoice.count({
      where: { pppoeAccountId: accountId, status: { in: ['PENDING', 'OVERDUE'] } },
    });

    if (pendingInvoices === 0) {
      const account = await this.prisma.pppoeAccount.findUnique({
        where: { id: accountId },
        select: { isActive: true },
      });
      if (account && !account.isActive) {
        await this.prisma.pppoeAccount.update({
          where: { id: accountId },
          data: { isActive: true, updatedAt: new Date() },
        });
      }
    }
  }

  private async findDeposit(id: string) {
    const deposit = await this.prisma.collectorDeposit.findUnique({
      where: { id: BigInt(id) },
      include: {
        account: { select: { id: true, customerName: true, customerNumber: true, phone: true } },
        collector: { select: { id: true, name: true } },
      },
    });
    if (!deposit) throw new NotFoundException('Setoran tidak ditemukan.');
    return deposit;
  }
}
