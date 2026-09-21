import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { AssignCollectorDto, SaveAreaDto } from './area.dto.js';

@Injectable()
export class AreaService {
  constructor(private readonly prisma: PrismaService) {}

  async list(search = '', page = 1, perPage = 10, user?: { id: string; role: string }) {
    const where: Prisma.AreaWhereInput = {
      ...(search ? { OR: [{ name: { contains: search } }, { description: { contains: search } }] } : {}),
      ...(user?.role === 'kolektor' ? { collectors: { some: { userId: BigInt(user.id) } } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.area.findMany({
        where,
        include: {
          collectors: {
            include: { user: { select: { id: true, name: true, email: true, phone: true, role: true } } },
          },
          _count: { select: { accounts: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.area.count({ where }),
    ]);
    return serialize({
      data: data.map((area) => ({
        ...area,
        accountsCount: area._count.accounts,
      })),
      meta: pageMeta(page, perPage, total),
    });
  }

  async options() {
    const data = await this.prisma.area.findMany({
      select: {
        id: true,
        name: true,
        collectors: {
          select: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return serialize({ data });
  }

  async create(dto: SaveAreaDto) {
    try {
      const area = await this.prisma.area.create({
        data: { name: dto.name.trim(), description: dto.description?.trim() || null },
      });
      if (dto.collectorUserId) {
        await this.prisma.areaCollector.create({
          data: { areaId: area.id, userId: BigInt(dto.collectorUserId) },
        }).catch(() => {});
      }
      return serialize({ message: 'Area berhasil ditambahkan.', area });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Nama area sudah digunakan.');
      }
      throw error;
    }
  }

  async update(id: string, dto: SaveAreaDto) {
    await this.findArea(id);
    try {
      const area = await this.prisma.area.update({
        where: { id: BigInt(id) },
        data: { name: dto.name.trim(), description: dto.description?.trim() || null },
      });
      return serialize({ message: 'Area berhasil diperbarui.', area });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Nama area sudah digunakan.');
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findArea(id);
    const accountCount = await this.prisma.pppoeAccount.count({ where: { areaId: BigInt(id) } });
    if (accountCount > 0) {
      throw new BadRequestException('Area masih memiliki pelanggan terdaftar dan tidak dapat dihapus.');
    }
    await this.prisma.area.delete({ where: { id: BigInt(id) } });
    return { message: 'Area berhasil dihapus.' };
  }

  async assignCollector(areaId: string, dto: AssignCollectorDto) {
    await this.findArea(areaId);
    const user = await this.prisma.user.findUnique({ where: { id: BigInt(dto.userId) } });
    if (!user) throw new NotFoundException('Pengguna tidak ditemukan.');
    if (user.role !== 'kolektor') throw new BadRequestException('Hanya pengguna dengan role kolektor yang dapat ditugaskan ke area.');
    try {
      await this.prisma.areaCollector.create({
        data: { areaId: BigInt(areaId), userId: BigInt(dto.userId) },
      });
      return { message: `Kolektor ${user.name} berhasil ditugaskan ke area.` };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Kolektor sudah ditugaskan ke area ini.');
      }
      throw error;
    }
  }

  async removeCollector(areaId: string, userId: string) {
    const deleted = await this.prisma.areaCollector.deleteMany({
      where: { areaId: BigInt(areaId), userId: BigInt(userId) },
    });
    if (deleted.count === 0) throw new NotFoundException('Kolektor tidak ditemukan di area ini.');
    return { message: 'Kolektor berhasil dihapus dari area.' };
  }

  async collectorOptions() {
    const data = await this.prisma.user.findMany({
      where: { role: 'kolektor', status: 'active' },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: 'asc' },
    });
    return serialize({ data });
  }

  async getAreaCustomers(areaId: string, search = '', status = 'ALL', user?: { id: string; role: string }) {
    const area = await this.findArea(areaId);
    if (user?.role === 'kolektor' && !await this.prisma.areaCollector.findFirst({ where: { areaId: BigInt(areaId), userId: BigInt(user.id) } })) {
      throw new BadRequestException('Area ini bukan tugas kolektor Anda. Gunakan menu Titipan untuk pelanggan di luar area.');
    }

    const collectors = await this.prisma.areaCollector.findMany({
      where: { areaId: BigInt(areaId) },
      include: { user: { select: { id: true, name: true, phone: true } } },
    });

    const where: Prisma.PppoeAccountWhereInput = {
      areaId: BigInt(areaId),
    };

    if (search.trim()) {
      where.OR = [
        { customerName: { contains: search.trim() } },
        { username: { contains: search.trim() } },
        { phone: { contains: search.trim() } },
        { address: { contains: search.trim() } },
      ];
    }

    const accounts = await this.prisma.pppoeAccount.findMany({
      where,
      include: {
        package: { select: { id: true, name: true, price: true } },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
            dueDate: true,
            paidAt: true,
            deposits: {
              select: { id: true, status: true, amount: true, createdAt: true },
              orderBy: { id: 'desc' },
              take: 1,
            },
          },
          orderBy: [{ status: 'asc' }, { dueDate: 'desc' }, { id: 'desc' }],
        },
      },
      orderBy: { customerName: 'asc' },
    });

    const mapped = accounts.map((acc) => {
      const unpaidInvoices = acc.invoices.filter((inv) => ['PENDING', 'OVERDUE'].includes(inv.status));
      const isPaid = unpaidInvoices.length === 0;
      const unpaidAmount = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

      const activeInvoice = unpaidInvoices[0] || null;
      const latestDeposit = activeInvoice?.deposits?.[0] || null;
      const hasPendingDeposit = latestDeposit?.status === 'PENDING';

      const now = new Date();
      const isOverdue = unpaidInvoices.some((inv) => new Date(inv.dueDate) < now);

      let billingStatus = 'PAID';
      if (!isPaid) {
        if (hasPendingDeposit) {
          billingStatus = 'PENDING_VERIFICATION';
        } else if (isOverdue) {
          billingStatus = 'OVERDUE';
        } else {
          billingStatus = 'UNPAID';
        }
      }

      return {
        id: acc.id,
        customerNumber: acc.customerNumber,
        customerName: acc.customerName,
        username: acc.username,
        phone: acc.phone,
        address: acc.address,
        isActive: acc.isActive,
        package: acc.package ? { ...acc.package, price: Number(acc.package.price) } : null,
        isPaid,
        billingStatus,
        unpaidAmount,
        unpaidCount: unpaidInvoices.length,
        activeInvoice: activeInvoice
          ? {
              id: activeInvoice.id,
              invoiceNumber: activeInvoice.invoiceNumber,
              amount: Number(activeInvoice.amount),
              dueDate: activeInvoice.dueDate,
              hasPendingDeposit,
              depositId: latestDeposit?.id || null,
            }
          : null,
      };
    });

    const allAccountsInArea = await this.prisma.pppoeAccount.findMany({
      where: { areaId: BigInt(areaId) },
      select: {
        id: true,
        invoices: {
          where: { status: { in: ['PENDING', 'OVERDUE'] } },
          select: { amount: true },
        },
      },
    });

    let totalUnpaidAmount = 0;
    let unpaidCustomers = 0;
    let paidCustomers = 0;

    for (const a of allAccountsInArea) {
      if (a.invoices.length > 0) {
        unpaidCustomers++;
        totalUnpaidAmount += a.invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      } else {
        paidCustomers++;
      }
    }

    let filteredData = mapped;
    if (status === 'UNPAID') {
      filteredData = mapped.filter((m) => !m.isPaid);
    } else if (status === 'PAID') {
      filteredData = mapped.filter((m) => m.isPaid);
    }

    return serialize({
      area: {
        id: area.id,
        name: area.name,
        description: area.description,
        collectors: collectors.map((c) => ({
          id: c.id,
          userId: c.userId,
          name: c.user.name,
          phone: c.user.phone,
        })),
      },
      summary: {
        totalCustomers: allAccountsInArea.length,
        unpaidCustomers,
        paidCustomers,
        totalUnpaidAmount,
      },
      customers: filteredData,
    });
  }

  private async findArea(id: string) {
    const area = await this.prisma.area.findUnique({ where: { id: BigInt(id) } });
    if (!area) throw new NotFoundException('Area tidak ditemukan.');
    return area;
  }
}
