import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface StatItem {
  timestamp: string; // ISO date or identifier
  label: string;     // e.g. "14:00", "17/09", "Sep 2026", "2025"
  cpuPercent: number;
  memPercent: number;
  netDown: number;
  netUp: number;
}

@Injectable()
export class ServerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(period: 'daily' | 'monthly' | 'yearly' = 'daily') {
    if (period === 'daily') {
      return this.getDaily();
    }
    if (period === 'monthly') {
      return this.getMonthly();
    }
    return this.getYearly();
  }

  private async getDaily(): Promise<{ period: string; data: StatItem[] }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await this.prisma.serverStat.findMany({
      where: { recordedAt: { gte: twentyFourHoursAgo } },
      orderBy: { recordedAt: 'asc' },
    });

    const data: StatItem[] = rows.map((r) => {
      const d = new Date(r.recordedAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return {
        timestamp: d.toISOString(),
        label: `${hh}:${mm}`,
        cpuPercent: Math.round(r.cpuPercent * 10) / 10,
        memPercent: Math.round(r.memPercent * 10) / 10,
        netDown: Math.round(r.netDown * 100) / 100,
        netUp: Math.round(r.netUp * 100) / 100,
      };
    });

    return { period: 'daily', data };
  }

  private async getMonthly(): Promise<{ period: string; data: StatItem[] }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows: {
      d: string;
      avgCpu: number;
      avgMem: number;
      avgDown: number;
      avgUp: number;
    }[] = await this.prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(recorded_at, '%Y-%m-%d') as d,
        AVG(cpu_percent) as avgCpu,
        AVG(mem_percent) as avgMem,
        AVG(net_down) as avgDown,
        AVG(net_up) as avgUp
      FROM server_stats
      WHERE recorded_at >= ${startOfMonth}
      GROUP BY DATE_FORMAT(recorded_at, '%Y-%m-%d')
      ORDER BY d ASC
    `;

    const data: StatItem[] = rows.map((r) => {
      const parts = r.d.split('-');
      const label = `${parts[2]}/${parts[1]}`; // DD/MM
      return {
        timestamp: r.d,
        label,
        cpuPercent: Math.round(Number(r.avgCpu) * 10) / 10,
        memPercent: Math.round(Number(r.avgMem) * 10) / 10,
        netDown: Math.round(Number(r.avgDown) * 100) / 100,
        netUp: Math.round(Number(r.avgUp) * 100) / 100,
      };
    });

    return { period: 'monthly', data };
  }

  private async getYearly(): Promise<{ period: string; data: StatItem[] }> {
    const now = new Date();
    const currentYear = now.getFullYear();

    // 1. Ambil data tahun-tahun sebelumnya dari server_stats_yearly
    const yearlyPast = await this.prisma.serverStatYearly.findMany({
      orderBy: { year: 'asc' },
    });

    // 2. Ambil data bulan-bulan tahun berjalan dari server_stats_monthly
    const monthlyCurrentYear = await this.prisma.serverStatMonthly.findMany({
      where: { year: currentYear },
      orderBy: { month: 'asc' },
    });

    // 3. Ambil data bulan berjalan langsung dari server_stats jika ada
    const currentMonthNum = now.getMonth() + 1;
    const startOfCurrentMonth = new Date(currentYear, now.getMonth(), 1);
    const currentMonthAgg: any[] = await this.prisma.$queryRaw`
      SELECT 
        AVG(cpu_percent) as avgCpu,
        AVG(mem_percent) as avgMem,
        AVG(net_down) as avgDown,
        AVG(net_up) as avgUp,
        COUNT(*) as cnt
      FROM server_stats
      WHERE recorded_at >= ${startOfCurrentMonth}
    `;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const data: StatItem[] = [];

    // Tambah tahun-tahun lalu
    for (const y of yearlyPast) {
      data.push({
        timestamp: `${y.year}`,
        label: `Tahun ${y.year}`,
        cpuPercent: y.cpuPercent,
        memPercent: y.memPercent,
        netDown: y.netDown,
        netUp: y.netUp,
      });
    }

    // Tambah bulan-bulan tahun berjalan yang sudah direkap
    for (const m of monthlyCurrentYear) {
      data.push({
        timestamp: `${m.year}-${String(m.month).padStart(2, '0')}`,
        label: `${monthNames[m.month - 1]} ${m.year}`,
        cpuPercent: m.cpuPercent,
        memPercent: m.memPercent,
        netDown: m.netDown,
        netUp: m.netUp,
      });
    }

    // Tambah bulan berjalan saat ini jika belum ada di monthlyCurrentYear
    if (
      !monthlyCurrentYear.some((m) => m.month === currentMonthNum) &&
      currentMonthAgg[0] &&
      Number(currentMonthAgg[0].cnt) > 0
    ) {
      data.push({
        timestamp: `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`,
        label: `${monthNames[currentMonthNum - 1]} ${currentYear}`,
        cpuPercent: Math.round(Number(currentMonthAgg[0].avgCpu) * 10) / 10,
        memPercent: Math.round(Number(currentMonthAgg[0].avgMem) * 10) / 10,
        netDown: Math.round(Number(currentMonthAgg[0].avgDown) * 100) / 100,
        netUp: Math.round(Number(currentMonthAgg[0].avgUp) * 100) / 100,
      });
    }

    return { period: 'yearly', data };
  }
}
