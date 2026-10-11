import { FinanceSalaryService, currentSalaryMonth, salaryMonth } from '../finance/salary/finance-salary.service.js';
import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthRequest } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(private readonly prisma: PrismaService, private readonly salary: FinanceSalaryService) { }

  @Get('stats')
  async stats(@Req() request: AuthRequest, @Query('year') year?: string, @Query('month') month?: string) {
    if (request.user.role === 'sales') return this.salesStats(request.user.id, year, month);
    const active = { deletedAt: null };
    const [totalServerCores, totalOdcs, totalOdps, totalWithRedaman] = await this.prisma.$transaction([
      this.prisma.mainCore.count({ where: { ...active, tipeTitik: 'server' } }),
      this.prisma.mainCore.count({ where: { ...active, tipeTitik: 'odc' } }),
      this.prisma.mainCore.count({ where: { ...active, tipeTitik: 'odp' } }),
      this.prisma.mainCore.count({ where: { ...active, redamanIn: { not: null } } }),
    ]);
    const result: Record<string, number> = { totalServerCores, totalOdcs, totalOdps, totalWithRedaman };
    if (request.user.role === 'admin') {
      result.totalTeknisi = await this.prisma.user.count({ where: { role: 'teknisi' } });
      result.totalUsers = await this.prisma.user.count();
    } else if (request.user.role === 'teknisi') {
      const rates = await this.salary.settings();
      const monthlyCompletedOrders = await this.prisma.psbOrder.count({ where: { completedByUserId: BigInt(request.user.id), status: 'COMPLETED', completedAt: currentSalaryMonth() } });
      const [newOrders, activatedOrders, completedOrders] = await this.prisma.$transaction([
        this.prisma.psbOrder.count({ where: { status: 'PROCESS' } }),
        this.prisma.psbOrder.count({ where: { status: 'ACTIVATED' } }),
        this.prisma.psbOrder.count({ where: { status: 'COMPLETED' } }),
      ]);
      return { newOrders, activatedOrders, completedOrders, monthlyCompletedOrders, salaryRate: rates.psb, monthlySalary: monthlyCompletedOrders * rates.psb };
    } else if (request.user.role === 'kolektor') {
      const [assignedCustomers, pendingDeposits, acceptedDeposits] = await this.prisma.$transaction([
        this.prisma.pppoeAccount.count({ where: { area: { collectors: { some: { userId: BigInt(request.user.id) } } } } }),
        this.prisma.collectorDeposit.count({ where: { collectorUserId: BigInt(request.user.id), status: 'PENDING' } }),
        this.prisma.collectorDeposit.count({ where: { collectorUserId: BigInt(request.user.id), status: 'ACCEPTED' } }),
      ]);
      return { assignedCustomers, pendingDeposits, acceptedDeposits };
    } else if (request.user.role === 'finance') {
      const [pendingDeposits, acceptedDeposits] = await this.prisma.$transaction([
        this.prisma.collectorDeposit.count({ where: { status: 'PENDING' } }),
        this.prisma.collectorDeposit.count({ where: { status: 'ACCEPTED' } }),
      ]);
      return { pendingDeposits, acceptedDeposits };
    }
    return result;
  }
  private async salesStats(userId: string, yearInput?: string, monthInput?: string) {
    const salesUserId = BigInt(userId);
    const now = new Date();
    const account = await this.prisma.user.findUnique({ where: { id: salesUserId }, select: { createdAt: true } });
    let createdAt = account?.createdAt;
    if (!createdAt) {
      const first = await this.prisma.psbOrder.findFirst({ where: { salesUserId }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
      createdAt = first?.createdAt ?? now;
    }
    const localParts = (date: Date) => {
      const local = new Date(date.getTime() + 7 * 60 * 60 * 1000);
      return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1 };
    };
    const current = localParts(now), start = localParts(createdAt);
    const year = yearInput === undefined ? current.year : Number(yearInput);
    const month = monthInput === undefined ? current.month : Number(monthInput);
    const index = year * 12 + month;
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 ||
      index < start.year * 12 + start.month || index > current.year * 12 + current.month) {
      throw new BadRequestException('Periode harus antara bulan akun dibuat dan bulan berjalan.');
    }
    const period = salaryMonth(year, month);
    const rates = await this.salary.settings();
    const [monthlyRegistrations, monthlyCompletedOrders] = await this.prisma.$transaction([
      this.prisma.psbOrder.count({ where: { salesUserId, createdAt: period } }),
      this.prisma.psbOrder.count({ where: { salesUserId, status: 'COMPLETED', completedAt: period } }),
    ]);
    return { monthlyRegistrations, monthlyCompletedOrders, salaryRate: rates.sales,
      monthlySalary: monthlyCompletedOrders * rates.sales, year, month,
      startYear: start.year, startMonth: start.month, currentYear: current.year, currentMonth: current.month };
  }

}
