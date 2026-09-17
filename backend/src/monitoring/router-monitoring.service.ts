import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MikrotikService } from '../router/mikrotik.service.js';
import { parseMikrotikUptime } from './stats-collector.service.js';
import type { PeriodeMonitoring, StatItem } from './server-stats.service.js';

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
            // Abaikan kegagalan pembacaan lalu lintas agar data router lainnya tetap tampil.
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

  async getStats(nasId: number, periode: PeriodeMonitoring = 'hari_ini') {
    if (periode === 'hari_ini') {
      return this.getHariIni(nasId);
    }
    if (periode === 'harian') {
      return this.getHarian(nasId);
    }
    if (periode === 'bulanan') {
      return this.getBulanan(nasId);
    }
    return this.getTahunan(nasId);
  }

  private async getHariIni(nasId: number): Promise<{ periode: string; data: StatItem[] }> {
    const duaPuluhEmpatJamLalu = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows: {
      kunciJam: string;
      label: string;
      rataCpu: number;
      rataMem: number;
      rataDown: number;
      rataUp: number;
    }[] = await this.prisma.$queryRaw`
      SELECT
        DATE_FORMAT(DATE_ADD(recorded_at, INTERVAL 7 HOUR), '%Y-%m-%d %H:00') as kunciJam,
        DATE_FORMAT(DATE_ADD(recorded_at, INTERVAL 7 HOUR), '%H:00') as label,
        AVG(cpu_percent) as rataCpu,
        AVG(mem_percent) as rataMem,
        AVG(net_down) as rataDown,
        AVG(net_up) as rataUp
      FROM router_stats
      WHERE nas_id = ${nasId} AND recorded_at >= ${duaPuluhEmpatJamLalu}
      GROUP BY kunciJam, label
      ORDER BY kunciJam ASC
    `;

    const data: StatItem[] = rows.map((r) => ({
      timestamp: r.kunciJam,
      label: r.label,
      cpuPercent: Math.round(Number(r.rataCpu) * 10) / 10,
      memPercent: Math.round(Number(r.rataMem) * 10) / 10,
      netDown: Math.round(Number(r.rataDown) * 100) / 100,
      netUp: Math.round(Number(r.rataUp) * 100) / 100,
    }));

    return { periode: 'hari_ini', data };
  }

  private async getHarian(nasId: number): Promise<{ periode: string; data: StatItem[] }> {
    const now = new Date();
    const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows: {
      d: string;
      rataCpu: number;
      rataMem: number;
      rataDown: number;
      rataUp: number;
    }[] = await this.prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(recorded_at, '%Y-%m-%d') as d,
        AVG(cpu_percent) as rataCpu,
        AVG(mem_percent) as rataMem,
        AVG(net_down) as rataDown,
        AVG(net_up) as rataUp
      FROM router_stats
      WHERE nas_id = ${nasId} AND recorded_at >= ${awalBulan}
      GROUP BY DATE_FORMAT(recorded_at, '%Y-%m-%d')
      ORDER BY d ASC
    `;

    const data: StatItem[] = rows.map((r) => {
      const parts = r.d.split('-');
      const label = `${parts[2]}/${parts[1]}`; // DD/MM
      return {
        timestamp: r.d,
        label,
        cpuPercent: Math.round(Number(r.rataCpu) * 10) / 10,
        memPercent: Math.round(Number(r.rataMem) * 10) / 10,
        netDown: Math.round(Number(r.rataDown) * 100) / 100,
        netUp: Math.round(Number(r.rataUp) * 100) / 100,
      };
    });

    return { periode: 'harian', data };
  }

  private async getBulanan(nasId: number): Promise<{ periode: string; data: StatItem[] }> {
    const now = new Date();
    const tahunIni = now.getFullYear();

    const bulananTahunIni = await this.prisma.routerStatMonthly.findMany({
      where: { nasId, year: tahunIni },
      orderBy: { month: 'asc' },
    });

    const nomorBulanIni = now.getMonth() + 1;
    const awalBulanIni = new Date(tahunIni, now.getMonth(), 1);
    const rekapBulanIni: any[] = await this.prisma.$queryRaw`
      SELECT 
        AVG(cpu_percent) as rataCpu,
        AVG(mem_percent) as rataMem,
        AVG(net_down) as rataDown,
        AVG(net_up) as rataUp,
        COUNT(*) as jumlah
      FROM router_stats
      WHERE nas_id = ${nasId} AND recorded_at >= ${awalBulanIni}
    `;

    const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const data: StatItem[] = [];

    for (const m of bulananTahunIni) {
      data.push({
        timestamp: `${m.year}-${String(m.month).padStart(2, '0')}`,
        label: `${namaBulan[m.month - 1]} ${m.year}`,
        cpuPercent: m.cpuPercent,
        memPercent: m.memPercent,
        netDown: m.netDown,
        netUp: m.netUp,
      });
    }

    if (
      !bulananTahunIni.some((m) => m.month === nomorBulanIni) &&
      rekapBulanIni[0] &&
      Number(rekapBulanIni[0].jumlah) > 0
    ) {
      data.push({
        timestamp: `${tahunIni}-${String(nomorBulanIni).padStart(2, '0')}`,
        label: `${namaBulan[nomorBulanIni - 1]} ${tahunIni}`,
        cpuPercent: Math.round(Number(rekapBulanIni[0].rataCpu) * 10) / 10,
        memPercent: Math.round(Number(rekapBulanIni[0].rataMem) * 10) / 10,
        netDown: Math.round(Number(rekapBulanIni[0].rataDown) * 100) / 100,
        netUp: Math.round(Number(rekapBulanIni[0].rataUp) * 100) / 100,
      });
    }

    return { periode: 'bulanan', data };
  }

  private async getTahunan(nasId: number): Promise<{ periode: string; data: StatItem[] }> {
    const now = new Date();
    const tahunIni = now.getFullYear();

    const tahunanSebelumnya = await this.prisma.routerStatYearly.findMany({
      where: { nasId },
      orderBy: { year: 'asc' },
    });

    const bulanTahunIni = await this.prisma.routerStatMonthly.findMany({
      where: { nasId, year: tahunIni },
      orderBy: { month: 'asc' },
    });

    const awalTahunIni = new Date(tahunIni, 0, 1);
    const rekapTahunIni: any[] = await this.prisma.$queryRaw`
      SELECT 
        AVG(cpu_percent) as rataCpu,
        AVG(mem_percent) as rataMem,
        AVG(net_down) as rataDown,
        AVG(net_up) as rataUp,
        COUNT(*) as jumlah
      FROM router_stats
      WHERE nas_id = ${nasId} AND recorded_at >= ${awalTahunIni}
    `;

    const data: StatItem[] = tahunanSebelumnya.map((y) => ({
      timestamp: `${y.year}`,
      label: `${y.year}`,
      cpuPercent: y.cpuPercent,
      memPercent: y.memPercent,
      netDown: y.netDown,
      netUp: y.netUp,
    }));

    const barisBerbobot = bulanTahunIni.map((m) => ({
      cpu: m.cpuPercent,
      mem: m.memPercent,
      down: m.netDown,
      up: m.netUp,
      samples: m.samples || 1,
    }));

    const rekapSaatIni = rekapTahunIni[0];
    if (rekapSaatIni && Number(rekapSaatIni.jumlah) > 0) {
      barisBerbobot.push({
        cpu: Number(rekapSaatIni.rataCpu),
        mem: Number(rekapSaatIni.rataMem),
        down: Number(rekapSaatIni.rataDown),
        up: Number(rekapSaatIni.rataUp),
        samples: Number(rekapSaatIni.jumlah),
      });
    }

    const totalSampel = barisBerbobot.reduce((sum, item) => sum + item.samples, 0);
    if (!tahunanSebelumnya.some((y) => y.year === tahunIni) && totalSampel > 0) {
      data.push({
        timestamp: `${tahunIni}`,
        label: `${tahunIni}`,
        cpuPercent: Math.round((barisBerbobot.reduce((sum, item) => sum + item.cpu * item.samples, 0) / totalSampel) * 10) / 10,
        memPercent: Math.round((barisBerbobot.reduce((sum, item) => sum + item.mem * item.samples, 0) / totalSampel) * 10) / 10,
        netDown: Math.round((barisBerbobot.reduce((sum, item) => sum + item.down * item.samples, 0) / totalSampel) * 100) / 100,
        netUp: Math.round((barisBerbobot.reduce((sum, item) => sum + item.up * item.samples, 0) / totalSampel) * 100) / 100,
      });
    }

    return { periode: 'tahunan', data };
  }
}
