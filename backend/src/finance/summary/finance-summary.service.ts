import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import { serialize } from '../../common/serialize.js';

@Injectable()
export class FinanceSummaryService {
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
}
