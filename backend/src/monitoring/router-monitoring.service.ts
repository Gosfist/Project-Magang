import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MikrotikService } from '../router/mikrotik.service.js';
import { parseMikrotikUptime } from './stats-collector.service.js';
import type { StatItem } from './server-stats.service.js';

@Injectable()
export class RouterMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mikrotik: MikrotikService,
  ) {}

  async options() {
    const routers = await this.prisma.nas.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nasname: true,
        shortname: true,
        ipAddress: true,
        description: true,
      },
      orderBy: { id: 'asc' },
    });

    return routers.map((r) => ({
      id: r.id,
      name: r.name || r.shortname || r.nasname,
      host: r.ipAddress || r.nasname,
      description: r.description,
    }));
  }

  async realtimeSnapshot(nasId: number) {
    const router = await this.prisma.nas.findUnique({
      where: { id: nasId },
    });

    if (!router || !router.isActive) {
      throw new NotFoundException('Router/NAS tidak ditemukan atau tidak aktif.');
    }

    try {
      return await this.mikrotik.withRouter(
        router,
        async (write) => {
          const resList = await write('/system/resource/print');
          const res = resList[0] || {};
          const cpuLoad = parseFloat(res['cpu-load'] || '0') || 0;
          const totalMem = Number(res['total-memory'] || 0);
          const freeMem = Number(res['free-memory'] || 0);
          const usedMem = Math.max(0, totalMem - freeMem);
          const memPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0;
          const uptimeSec = parseMikrotikUptime(res['uptime'] || '');

          let netDown = 0;
          let netUp = 0;

          try {
            const interfaces = await write('/interface/print', [
              '?running=true',
              '=.proplist=name,type',
            ]);
            const physical = interfaces.filter(
              (i) => i.type === 'ether' || i.type === 'sfp' || i.type === 'bridge',
            );
            const targetNames = (physical.length ? physical : interfaces)
              .map((i) => i.name)
              .slice(0, 4);

            for (const ifName of targetNames) {
              const mon = await write('/interface/monitor-traffic', [
                `=interface=${ifName}`,
                '=once=',
              ]);
              if (mon[0]) {
                const rxBps = parseFloat(mon[0]['rx-bits-per-second'] || '0') || 0;
                const txBps = parseFloat(mon[0]['tx-bits-per-second'] || '0') || 0;
                netDown += rxBps / 1_000_000;
                netUp += txBps / 1_000_000;
              }
            }
          } catch {
            // Ignore traffic failure
          }

          return {
            router: {
              id: router.id,
              name: router.name || router.nasname,
              host: router.ipAddress || router.nasname,
            },
            uptime: uptimeSec,
            cpu: {
              percent: cpuLoad,
              cores: parseInt(res['cpu-count'] || '1', 10),
              model: res['cpu'] || '-',
            },
            memory: {
              total: totalMem,
              free: freeMem,
              used: usedMem,
              percent: memPercent,
            },
            network: {
              download: Math.round(netDown * 100) / 100,
              upload: Math.round(netUp * 100) / 100,
            },
            board: {
              name: res['board-name'] || '-',
              version: res['version'] || '-',
              architecture: res['architecture-name'] || '-',
            },
            checkedAt: new Date().toISOString(),
          };
        },
        10000,
      );
    } catch (err) {
      throw new BadRequestException(this.mikrotik.errorMessage(err));
    }
  }

  async logs(nasId: number) {
    const router = await this.prisma.nas.findUnique({
      where: { id: nasId },
    });

    if (!router || !router.isActive) {
      throw new NotFoundException('Router/NAS tidak ditemukan atau tidak aktif.');
    }

    try {
      return await this.mikrotik.withRouter(
        router,
        async (write) => {
          const logRows = await write('/log/print');
          // Ambil maksimal 100 log terakhir, balik urutannya agar terbaru di atas
          const sliced = logRows.slice(-100).reverse();
          return sliced.map((row) => ({
            id: row['.id'] || '',
            time: row['time'] || '',
            topics: row['topics'] || '',
            message: row['message'] || '',
          }));
        },
        10000,
      );
    } catch (err) {
      throw new BadRequestException(this.mikrotik.errorMessage(err));
    }
  }

  async getStats(nasId: number, period: 'daily' | 'monthly' | 'yearly' = 'daily') {
    if (period === 'daily') {
      return this.getDaily(nasId);
    }
    if (period === 'monthly') {
      return this.getMonthly(nasId);
    }
    return this.getYearly(nasId);
  }

  private async getDaily(nasId: number): Promise<{ period: string; data: StatItem[] }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await this.prisma.routerStat.findMany({
      where: { nasId, recordedAt: { gte: twentyFourHoursAgo } },
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

  private async getMonthly(nasId: number): Promise<{ period: string; data: StatItem[] }> {
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
      FROM router_stats
      WHERE nas_id = ${nasId} AND recorded_at >= ${startOfMonth}
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

  private async getYearly(nasId: number): Promise<{ period: string; data: StatItem[] }> {
    const now = new Date();
    const currentYear = now.getFullYear();

    const yearlyPast = await this.prisma.routerStatYearly.findMany({
      where: { nasId },
      orderBy: { year: 'asc' },
    });

    const monthlyCurrentYear = await this.prisma.routerStatMonthly.findMany({
      where: { nasId, year: currentYear },
      orderBy: { month: 'asc' },
    });

    const currentMonthNum = now.getMonth() + 1;
    const startOfCurrentMonth = new Date(currentYear, now.getMonth(), 1);
    const currentMonthAgg: any[] = await this.prisma.$queryRaw`
      SELECT 
        AVG(cpu_percent) as avgCpu,
        AVG(mem_percent) as avgMem,
        AVG(net_down) as avgDown,
        AVG(net_up) as avgUp,
        COUNT(*) as cnt
      FROM router_stats
      WHERE nas_id = ${nasId} AND recorded_at >= ${startOfCurrentMonth}
    `;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    const data: StatItem[] = [];

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
