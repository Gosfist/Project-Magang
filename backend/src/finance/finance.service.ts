import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { pageMeta, serialize } from '../common/serialize.js';
import { CreateTransactionDto, UpdateTransactionDto } from './finance.dto.js';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(month?: number, year?: number) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1;

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const dateFilter = {
      transactionDate: { gte: startDate, lte: endDate },
    };

    const [income, expense, allIncome, allExpense] = await this.prisma.$transaction([
      this.prisma.financeTransaction.aggregate({
        where: { ...dateFilter, type: 'INCOME' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financeTransaction.aggregate({
        where: { ...dateFilter, type: 'EXPENSE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.financeTransaction.aggregate({
        where: { type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.financeTransaction.aggregate({
        where: { type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    // Pending deposits count
    const pendingDeposits = await this.prisma.collectorDeposit.count({
      where: { status: 'PENDING' },
    });

    return serialize({
      month: targetMonth,
      year: targetYear,
      monthlyIncome: Number(income._sum.amount ?? 0),
      monthlyExpense: Number(expense._sum.amount ?? 0),
      monthlyBalance: Number(income._sum.amount ?? 0) - Number(expense._sum.amount ?? 0),
      monthlyIncomeCount: income._count ?? 0,
      monthlyExpenseCount: expense._count ?? 0,
      totalIncome: Number(allIncome._sum.amount ?? 0),
      totalExpense: Number(allExpense._sum.amount ?? 0),
      totalBalance: Number(allIncome._sum.amount ?? 0) - Number(allExpense._sum.amount ?? 0),
      pendingDeposits,
    });
  }

  async list(
    search = '',
    type = '',
    category = '',
    startDate = '',
    endDate = '',
    page = 1,
    perPage = 15,
  ) {
    const where: Prisma.FinanceTransactionWhereInput = {};

    if (search) {
      where.description = { contains: search };
    }
    if (type && ['INCOME', 'EXPENSE'].includes(type)) {
      where.type = type;
    }
    if (category) {
      where.category = category;
    }
    if (startDate || endDate) {
      where.transactionDate = {};
      if (startDate) where.transactionDate.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.transactionDate.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.financeTransaction.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.financeTransaction.count({ where }),
    ]);

    return serialize({
      data: data.map((t) => ({ ...t, amount: Number(t.amount) })),
      meta: pageMeta(page, perPage, total),
    });
  }

  async create(dto: CreateTransactionDto, userId: string) {
    const transaction = await this.prisma.financeTransaction.create({
      data: {
        type: dto.type,
        category: dto.category.trim(),
        amount: BigInt(dto.amount),
        description: dto.description.trim(),
        referenceType: dto.referenceType || null,
        referenceId: dto.referenceId ? BigInt(dto.referenceId) : null,
        createdByUserId: BigInt(userId),
        transactionDate: new Date(`${dto.transactionDate}T00:00:00.000Z`),
      },
    });
    return serialize({ message: 'Transaksi berhasil ditambahkan.', transaction: { ...transaction, amount: Number(transaction.amount) } });
  }

  async update(id: string, dto: UpdateTransactionDto) {
    await this.findTransaction(id);
    const transaction = await this.prisma.financeTransaction.update({
      where: { id: BigInt(id) },
      data: {
        type: dto.type,
        category: dto.category.trim(),
        amount: BigInt(dto.amount),
        description: dto.description.trim(),
        referenceType: dto.referenceType || null,
        referenceId: dto.referenceId ? BigInt(dto.referenceId) : null,
        transactionDate: new Date(`${dto.transactionDate}T00:00:00.000Z`),
      },
    });
    return serialize({ message: 'Transaksi berhasil diperbarui.', transaction: { ...transaction, amount: Number(transaction.amount) } });
  }

  async remove(id: string) {
    await this.findTransaction(id);
    await this.prisma.financeTransaction.delete({ where: { id: BigInt(id) } });
    return { message: 'Transaksi berhasil dihapus.' };
  }

  async categories() {
    const results = await this.prisma.financeTransaction.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return { data: results.map((r) => r.category) };
  }

  private async findTransaction(id: string) {
    const t = await this.prisma.financeTransaction.findUnique({ where: { id: BigInt(id) } });
    if (!t) throw new NotFoundException('Transaksi tidak ditemukan.');
    return t;
  }
}
