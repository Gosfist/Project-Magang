import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MonitoringService } from '../server/server.service.js';

@Injectable()
export class StatsCollectorService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isCollecting = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly monitoringService: MonitoringService,
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
      await this.reconcileMonthlyAndYearly();
    } catch (err) {
      console.error('[StatsCollector] Gagal menjalankan pengumpulan statistik:', err);
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
      console.error('[StatsCollector] Gagal mengambil statistik server:', err);
    }
  }

  /**
   * Rekap bulanan dan tahunan:
   * 1. Data harian disimpan selama bulan berjalan.
   * 2. Begitu masuk bulan baru, seluruh data bulan sebelumnya di-rekap rata-ratanya ke tabel _monthly,
   *    lalu data harian bulan kemarin dihapus dari tabel harian.
   * 3. Begitu masuk tahun baru, data bulanan tahun kemarin di-rekap rata-ratanya ke tabel _yearly,
   *    lalu data bulanan tahun kemarin dihapus dari tabel bulanan.
   */
  async reconcileMonthlyAndYearly() {
    const now = new Date();
    const currentYear = now.getFullYear();
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
      console.error('[StatsCollector] Gagal merekap statistik bulanan server:', err);
    }

    // 2. REKAP TAHUNAN SERVER: Untuk tahun-tahun sebelum tahun berjalan
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

    } catch (err) {
      console.error('[StatsCollector] Gagal merekap statistik tahunan:', err);
    }
  }
}
