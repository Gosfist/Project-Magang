import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MonitoringService } from './monitoring.service.js';
import { MikrotikService } from '../router/mikrotik.service.js';

export function parseMikrotikUptime(str: string): number {
  if (!str) return 0;
  let totalSeconds = 0;
  const weeks = str.match(/(\d+)w/);
  if (weeks) totalSeconds += parseInt(weeks[1], 10) * 7 * 86400;
  const days = str.match(/(\d+)d/);
  if (days) totalSeconds += parseInt(days[1], 10) * 86400;
  const hours = str.match(/(\d+)h/);
  if (hours) totalSeconds += parseInt(hours[1], 10) * 3600;
  const minutes = str.match(/(\d+)m/);
  if (minutes) totalSeconds += parseInt(minutes[1], 10) * 60;
  const seconds = str.match(/(\d+)s/);
  if (seconds) totalSeconds += parseInt(seconds[1], 10);

  const timeMatch = str.match(/(?:^|[a-z])(\d{1,2}):(\d{2}):(\d{2})/);
  if (timeMatch) {
    totalSeconds += parseInt(timeMatch[1], 10) * 3600;
    totalSeconds += parseInt(timeMatch[2], 10) * 60;
    totalSeconds += parseInt(timeMatch[3], 10);
  }
  return totalSeconds;
}

@Injectable()
export class StatsCollectorService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isCollecting = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoringService: MonitoringService,
    private readonly mikrotik: MikrotikService,
  ) {}

  onModuleInit() {
    // Jalankan segera setelah boot, lalu setiap 1 jam (60 * 60 * 1000 ms)
    setTimeout(() => void this.collectAll(), 5000);
    this.timer = setInterval(() => void this.collectAll(), 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async collectAll() {
    if (this.isCollecting) return;
    this.isCollecting = true;
    try {
      await this.collectServerStats();
      await this.collectRouterStats();
      await this.reconcileMonthlyAndYearly();
    } catch (err) {
      console.error('[StatsCollector] Error during stats collection:', err);
    } finally {
      this.isCollecting = false;
    }
  }

  private async collectServerStats() {
    try {
      const snapshot = await this.monitoringService.snapshot();
      const recordedAt = new Date();

      await this.prisma.serverStat.create({
        data: {
          recordedAt,
          cpuPercent: snapshot.cpu?.percent ?? 0,
          memPercent: snapshot.memory?.percent ?? 0,
          memUsed: BigInt(Math.max(0, Math.round(snapshot.memory?.used ?? 0))),
          memTotal: BigInt(Math.max(0, Math.round(snapshot.memory?.total ?? 0))),
          netDown: snapshot.traffic?.download ?? 0,
          netUp: snapshot.traffic?.upload ?? 0,
        },
      });
    } catch (err) {
      console.error('[StatsCollector] Failed to collect server stats:', err);
    }
  }

  private async collectRouterStats() {
    const routers = await this.prisma.nas.findMany({
      where: { isActive: true },
    });

    const recordedAt = new Date();

    for (const router of routers) {
      try {
        await this.mikrotik.withRouter(
          router,
          async (write) => {
            const resList = await write('/system/resource/print');
            const res = resList[0] || {};
            const cpuPercent = parseFloat(res['cpu-load'] || '0') || 0;
            const totalMem = BigInt(res['total-memory'] || '0');
            const freeMem = BigInt(res['free-memory'] || '0');
            const memPercent =
              totalMem > 0n
                ? Number(((totalMem - freeMem) * 1000n) / totalMem) / 10
                : 0;
            const uptime = BigInt(parseMikrotikUptime(res['uptime'] || ''));

            let netDown = 0;
            let netUp = 0;

            try {
              // Coba baca traffic interface yang aktif/running
              const interfaces = await write('/interface/print', [
                '?running=true',
                '=.proplist=name,type',
              ]);
              const physical = interfaces.filter(
                (i) => i.type === 'ether' || i.type === 'sfp' || i.type === 'bridge',
              );
              const targetNames = (physical.length ? physical : interfaces)
                .map((i) => i.name)
                .slice(0, 3); // batasi 3 interface utama

              if (targetNames.length) {
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
              }
            } catch {
              // Jika monitor-traffic gagal/ditolak, abaikan traffic
            }

            await this.prisma.routerStat.create({
              data: {
                nasId: router.id,
                recordedAt,
                cpuPercent,
                memPercent,
                memFree: freeMem,
                memTotal: totalMem,
                netDown: Math.round(netDown * 100) / 100,
                netUp: Math.round(netUp * 100) / 100,
                uptime,
              },
            });
          },
          8000,
        );
      } catch (err) {
        // Router offline atau tidak bisa dihubungi
        console.warn(`[StatsCollector] NAS ${router.id} (${router.name || router.nasname}) skipped:`, (err as Error).message);
      }
    }
  }

  /**
   * Reconcile Monthly & Yearly:
   * 1. Data harian disimpan selama bulan berjalan.
   * 2. Begitu masuk bulan baru, seluruh data bulan sebelumnya di-rekap rata-ratanya ke tabel _monthly,
   *    lalu data harian bulan kemarin dihapus dari tabel harian.
   * 3. Begitu masuk tahun baru, data bulanan tahun kemarin di-rekap rata-ratanya ke tabel _yearly,
   *    lalu data bulanan tahun kemarin dihapus dari tabel bulanan.
   */
  async reconcileMonthlyAndYearly() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1 - 12
    const startOfCurrentMonth = new Date(currentYear, now.getMonth(), 1);

    // 1. REKAP BULANAN SERVER: Cek apakah ada data server_stats sebelum awal bulan ini
    try {
      const oldServerStats = await this.prisma.serverStat.findFirst({
        where: { recordedAt: { lt: startOfCurrentMonth } },
        select: { id: true },
      });

      if (oldServerStats) {
        // Cari daftar (year, month) yang ada di data lama
        const periods: { y: number; m: number }[] = await this.prisma.$queryRaw`
          SELECT DISTINCT YEAR(recorded_at) AS y, MONTH(recorded_at) AS m
          FROM server_stats
          WHERE recorded_at < ${startOfCurrentMonth}
        `;

        for (const p of periods) {
          const y = Number(p.y);
          const m = Number(p.m);
          const start = new Date(y, m - 1, 1);
          const end = new Date(y, m, 1);

          const agg: any[] = await this.prisma.$queryRaw`
            SELECT 
              AVG(cpu_percent) as avgCpu,
              AVG(mem_percent) as avgMem,
              AVG(net_down) as avgDown,
              AVG(net_up) as avgUp,
              COUNT(*) as totalSamples
            FROM server_stats
            WHERE recorded_at >= ${start} AND recorded_at < ${end}
          `;

          if (agg[0] && Number(agg[0].totalSamples) > 0) {
            await this.prisma.serverStatMonthly.upsert({
              where: { year_month: { year: y, month: m } },
              create: {
                year: y,
                month: m,
                cpuPercent: Math.round(Number(agg[0].avgCpu) * 10) / 10,
                memPercent: Math.round(Number(agg[0].avgMem) * 10) / 10,
                netDown: Math.round(Number(agg[0].avgDown) * 100) / 100,
                netUp: Math.round(Number(agg[0].avgUp) * 100) / 100,
                samples: Number(agg[0].totalSamples),
              },
              update: {
                cpuPercent: Math.round(Number(agg[0].avgCpu) * 10) / 10,
                memPercent: Math.round(Number(agg[0].avgMem) * 10) / 10,
                netDown: Math.round(Number(agg[0].avgDown) * 100) / 100,
                netUp: Math.round(Number(agg[0].avgUp) * 100) / 100,
                samples: Number(agg[0].totalSamples),
              },
            });
          }

          // Hapus data harian bulan tersebut setelah berhasil direkap
          await this.prisma.serverStat.deleteMany({
            where: { recordedAt: { gte: start, lt: end } },
          });
        }
      }
    } catch (err) {
      console.error('[StatsCollector] Error reconciling server monthly stats:', err);
    }

    // 2. REKAP BULANAN ROUTER: Cek apakah ada data router_stats sebelum awal bulan ini
    try {
      const oldRouterStats = await this.prisma.routerStat.findFirst({
        where: { recordedAt: { lt: startOfCurrentMonth } },
        select: { id: true },
      });

      if (oldRouterStats) {
        const routerPeriods: { nas_id: number; y: number; m: number }[] = await this.prisma.$queryRaw`
          SELECT DISTINCT nas_id, YEAR(recorded_at) AS y, MONTH(recorded_at) AS m
          FROM router_stats
          WHERE recorded_at < ${startOfCurrentMonth}
        `;

        for (const p of routerPeriods) {
          const nasId = Number(p.nas_id);
          const y = Number(p.y);
          const m = Number(p.m);
          const start = new Date(y, m - 1, 1);
          const end = new Date(y, m, 1);

          const agg: any[] = await this.prisma.$queryRaw`
            SELECT 
              AVG(cpu_percent) as avgCpu,
              AVG(mem_percent) as avgMem,
              AVG(net_down) as avgDown,
              AVG(net_up) as avgUp,
              COUNT(*) as totalSamples
            FROM router_stats
            WHERE nas_id = ${nasId} AND recorded_at >= ${start} AND recorded_at < ${end}
          `;

          if (agg[0] && Number(agg[0].totalSamples) > 0) {
            await this.prisma.routerStatMonthly.upsert({
              where: { nasId_year_month: { nasId, year: y, month: m } },
              create: {
                nasId,
                year: y,
                month: m,
                cpuPercent: Math.round(Number(agg[0].avgCpu) * 10) / 10,
                memPercent: Math.round(Number(agg[0].avgMem) * 10) / 10,
                netDown: Math.round(Number(agg[0].avgDown) * 100) / 100,
                netUp: Math.round(Number(agg[0].avgUp) * 100) / 100,
                samples: Number(agg[0].totalSamples),
              },
              update: {
                cpuPercent: Math.round(Number(agg[0].avgCpu) * 10) / 10,
                memPercent: Math.round(Number(agg[0].avgMem) * 10) / 10,
                netDown: Math.round(Number(agg[0].avgDown) * 100) / 100,
                netUp: Math.round(Number(agg[0].avgUp) * 100) / 100,
                samples: Number(agg[0].totalSamples),
              },
            });
          }

          // Hapus data harian router bulan tersebut
          await this.prisma.routerStat.deleteMany({
            where: { nasId, recordedAt: { gte: start, lt: end } },
          });
        }
      }
    } catch (err) {
      console.error('[StatsCollector] Error reconciling router monthly stats:', err);
    }

    // 3. REKAP TAHUNAN (Server & Router): Untuk tahun-tahun sebelum currentYear
    try {
      const oldServerMonths = await this.prisma.serverStatMonthly.findMany({
        where: { year: { lt: currentYear } },
      });

      if (oldServerMonths.length) {
        const years = [...new Set(oldServerMonths.map((o) => o.year))];
        for (const y of years) {
          const items = oldServerMonths.filter((o) => o.year === y);
          const totalSamples = items.reduce((acc, i) => acc + i.samples, 0) || 1;
          const avgCpu = items.reduce((acc, i) => acc + i.cpuPercent, 0) / items.length;
          const avgMem = items.reduce((acc, i) => acc + i.memPercent, 0) / items.length;
          const avgDown = items.reduce((acc, i) => acc + i.netDown, 0) / items.length;
          const avgUp = items.reduce((acc, i) => acc + i.netUp, 0) / items.length;

          await this.prisma.serverStatYearly.upsert({
            where: { year: y },
            create: {
              year: y,
              cpuPercent: Math.round(avgCpu * 10) / 10,
              memPercent: Math.round(avgMem * 10) / 10,
              netDown: Math.round(avgDown * 100) / 100,
              netUp: Math.round(avgUp * 100) / 100,
              samples: totalSamples,
            },
            update: {
              cpuPercent: Math.round(avgCpu * 10) / 10,
              memPercent: Math.round(avgMem * 10) / 10,
              netDown: Math.round(avgDown * 100) / 100,
              netUp: Math.round(avgUp * 100) / 100,
              samples: totalSamples,
            },
          });

          await this.prisma.serverStatMonthly.deleteMany({
            where: { year: y },
          });
        }
      }

      const oldRouterMonths = await this.prisma.routerStatMonthly.findMany({
        where: { year: { lt: currentYear } },
      });

      if (oldRouterMonths.length) {
        const combinations = [
          ...new Set(oldRouterMonths.map((o) => `${o.nasId}:${o.year}`)),
        ];
        for (const combo of combinations) {
          const [nasIdStr, yStr] = combo.split(':');
          const nasId = Number(nasIdStr);
          const y = Number(yStr);
          const items = oldRouterMonths.filter(
            (o) => o.nasId === nasId && o.year === y,
          );
          const totalSamples = items.reduce((acc, i) => acc + i.samples, 0) || 1;
          const avgCpu = items.reduce((acc, i) => acc + i.cpuPercent, 0) / items.length;
          const avgMem = items.reduce((acc, i) => acc + i.memPercent, 0) / items.length;
          const avgDown = items.reduce((acc, i) => acc + i.netDown, 0) / items.length;
          const avgUp = items.reduce((acc, i) => acc + i.netUp, 0) / items.length;

          await this.prisma.routerStatYearly.upsert({
            where: { nasId_year: { nasId, year: y } },
            create: {
              nasId,
              year: y,
              cpuPercent: Math.round(avgCpu * 10) / 10,
              memPercent: Math.round(avgMem * 10) / 10,
              netDown: Math.round(avgDown * 100) / 100,
              netUp: Math.round(avgUp * 100) / 100,
              samples: totalSamples,
            },
            update: {
              cpuPercent: Math.round(avgCpu * 10) / 10,
              memPercent: Math.round(avgMem * 10) / 10,
              netDown: Math.round(avgDown * 100) / 100,
              netUp: Math.round(avgUp * 100) / 100,
              samples: totalSamples,
            },
          });

          await this.prisma.routerStatMonthly.deleteMany({
            where: { nasId, year: y },
          });
        }
      }
    } catch (err) {
      console.error('[StatsCollector] Error reconciling yearly stats:', err);
    }
  }
}
