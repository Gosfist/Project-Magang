import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { serialize } from '../../common/serialize.js';
import { WhatsappNotifyService } from '../../bot-whatsapp/shared/whatsapp-notify.service.js';

@Injectable()
export class FinanceInvoicesService {
  private readonly logger = new Logger(FinanceInvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waNotify?: WhatsappNotifyService,
  ) {}

  async unpaidInvoices(search = '', outsideAreaCollectorId = '') {
    const where: Prisma.InvoiceWhereInput = {
      pppoeAccountId: { not: null },
      status: { in: ['PENDING', 'OVERDUE'] },
      deposits: {
        none: {
          status: { in: ['PENDING', 'ACCEPTED'] },
        },
      },
    };

    if (outsideAreaCollectorId) {
      where.account = { is: { area: { is: { collectors: { none: { userId: BigInt(outsideAreaCollectorId) } } } } } };
    }

    const customerNumber = search.trim();
    if (!/^\d+$/.test(customerNumber)) return { data: [] };
    where.AND = [{ account: { customerNumber: BigInt(customerNumber) } }];

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

    let emptyMessage = '';
    if (!data.length) {
      const account = await this.prisma.pppoeAccount.findFirst({
        where: {
          customerNumber: BigInt(customerNumber),
          ...(outsideAreaCollectorId ? { area: { is: { collectors: { none: { userId: BigInt(outsideAreaCollectorId) } } } } } : {}),
        },
        select: { customerNumber: true, customerName: true, invoices: { where: { status: { in: ['PENDING', 'OVERDUE'] } }, select: { id: true } } },
      });
      const number = (account?.customerNumber ?? BigInt(customerNumber)).toString().padStart(6, '0');
      emptyMessage = account
        ? `No Id pelanggan ${number} An ${account.customerName} ${account.invoices.length ? 'memiliki setoran yang sedang menunggu Finance.' : 'tidak ada tagihan / sudah lunas.'}`
        : `No Id pelanggan ${number} tidak ditemukan pada daftar pelanggan yang dapat dicatat di sini.`;
    }
    return serialize({
      emptyMessage,
      data: data.map((inv) => ({
        ...inv,
        amount: Number(inv.amount),
        baseAmount: Number(inv.baseAmount),
        discount: Number(inv.discount),
      })),
    });
  }

  async invoiceOverview(search = '', status = '') {
    const where: Prisma.PppoeAccountWhereInput = {};
    if (search.trim()) {
      const number = search.trim();
      if (/^\d+$/.test(number)) where.customerNumber = BigInt(number);
      else where.id = { in: [] };
    }

    const accounts = await this.prisma.pppoeAccount.findMany({
      where,
      include: {
        area: {
          select: {
            id: true,
            name: true,
            collectors: { select: { user: { select: { id: true, name: true } } } },
          },
        },
        package: { select: { name: true } },
        invoices: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: [{ dueDate: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            id: true, invoiceNumber: true, amount: true, dueDate: true, status: true, paidAt: true,
            deposits: {
              where: { status: 'ACCEPTED', acceptedAt: { not: null } },
              orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }],
              take: 1,
              select: { acceptedAt: true },
            },
          },
        },
      },
      orderBy: { customerName: 'asc' },
      take: 1000,
    });

    const data = accounts.map((account) => {
      const invoice = account.invoices[0] ?? null;
      return {
        id: account.id,
        customerNumber: account.customerNumber,
        customerName: account.customerName,
        username: account.username,
        phone: account.phone,
        isActive: account.isActive,
        packageName: account.package.name,
        area: account.area ? { id: account.area.id, name: account.area.name } : null,
        collectors: account.area?.collectors.map((item) => ({ id: item.user.id, name: item.user.name })) ?? [],
        invoice: invoice ? {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amount: Number(invoice.amount),
          dueDate: invoice.dueDate,
          status: invoice.status,
          paidAt: invoice.paidAt,
          acceptedAt: invoice.deposits[0]?.acceptedAt ?? null,
        } : null,
      };
    }).filter((row) => {
      if (!status) return true;
      if (status === 'ISOLATED') return !row.isActive;
      if (status === 'NO_INVOICE') return !row.invoice;
      return row.invoice?.status === status;
    });

    return serialize({ data });
  }
}
