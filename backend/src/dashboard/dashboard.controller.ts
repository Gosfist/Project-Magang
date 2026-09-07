import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthRequest } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

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
      result.totalPetugas = await this.prisma.user.count({ where: { role: 'petugas' } });
      result.totalUsers = await this.prisma.user.count();
    }
    return result;
  }
}
