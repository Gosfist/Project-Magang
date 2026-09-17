import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface StatItem {
  timestamp: string; // Penanda waktu untuk grafik dan tabel
  label: string;     // Label yang tampil di grafik, contoh "14:00", "17/09", "Sep 2026", "2025"
  cpuPercent: number;
  memPercent: number;
  netDown: number;
  netUp: number;
}

// Nilai periode dipakai frontend dan backend untuk memilih bentuk rekap grafik.
export type PeriodeMonitoring = 'hari_ini' | 'harian' | 'bulanan' | 'tahunan';

@Injectable()
export class ServerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(periode: PeriodeMonitoring = 'hari_ini') {
    if (periode === 'hari_ini') {
      return this.getHariIni();
    }
    if (periode === 'harian') {
      return this.getHarian();
    }
    if (periode === 'bulanan') {
      return this.getBulanan();
    }
    return this.getTahunan();
  }

  private async getHariIni(): Promise<{ periode: string; data: StatItem[] }> {
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
      FROM server_stats
      WHERE recorded_at >= ${duaPuluhEmpatJamLalu}
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

  private async getHarian(): Promise<{ periode: string; data: StatItem[] }> {
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
      FROM server_stats
      WHERE recorded_at >= ${awalBulan}
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

  private async getBulanan(): Promise<{ periode: string; data: StatItem[] }> {
    const now = new Date();
    const tahunIni = now.getFullYear();

    const bulananTahunIni = await this.prisma.serverStatMonthly.findMany({
      where: { year: tahunIni },
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
      FROM server_stats
      WHERE recorded_at >= ${awalBulanIni}
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

  private async getTahunan(): Promise<{ periode: string; data: StatItem[] }> {
    const now = new Date();
    const tahunIni = now.getFullYear();

    const tahunanSebelumnya = await this.prisma.serverStatYearly.findMany({
      orderBy: { year: 'asc' },
    });

    const bulanTahunIni = await this.prisma.serverStatMonthly.findMany({
      where: { year: tahunIni },
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
      FROM server_stats
      WHERE recorded_at >= ${awalTahunIni}
    `;

    const data: StatItem[] = tahunanSebelumnya.map((y) => ({
      timestamp: `${y.year}`,
      label: `${y.year}`,
      cpuPercent: y.cpuPercent,
      memPercent: y.memPercent,
      netDown: y.netDown,
      netUp: y.netUp,
    }));

    const barisBerbobot = [
      ...bulanTahunIni.map((m) => ({
        cpu: m.cpuPercent,
        mem: m.memPercent,
        down: m.netDown,
        up: m.netUp,
        samples: m.samples || 1,
      })),
    ];

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
