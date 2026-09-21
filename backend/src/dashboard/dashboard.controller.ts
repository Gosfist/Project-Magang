import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthRequest } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) { }

  @Get('stats')
  async stats(@Req() request: AuthRequest) {
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
    } else if (request.user.role === 'sales') {
      const salesUserId = BigInt(request.user.id);
      const [totalRegistrations, processOrders, completedOrders] = await this.prisma.$transaction([
        this.prisma.psbOrder.count({ where: { salesUserId } }),
        this.prisma.psbOrder.count({ where: { salesUserId, status: { not: 'COMPLETED' } } }),
        this.prisma.psbOrder.count({ where: { salesUserId, status: 'COMPLETED' } }),
      ]);
      return { totalRegistrations, processOrders, completedOrders };
    } else if (request.user.role === 'teknisi') {
      const [newOrders, activatedOrders, completedOrders] = await this.prisma.$transaction([
        this.prisma.psbOrder.count({ where: { status: 'PROCESS' } }),
        this.prisma.psbOrder.count({ where: { status: 'ACTIVATED' } }),
        this.prisma.psbOrder.count({ where: { status: 'COMPLETED' } }),
      ]);
      return { newOrders, activatedOrders, completedOrders };
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
}
