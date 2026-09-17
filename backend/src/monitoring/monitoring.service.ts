import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { cpus, freemem, totalmem, uptime, hostname, platform, networkInterfaces } from 'node:os';
import { networkStats, networkInterfaceDefault } from 'systeminformation';
import { readLocalDiskTotals } from './monitoring-disk.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { tap, timer, exhaustMap, shareReplay } from 'rxjs';

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private previous = this.cpuTotals();
  private sampledAt = 0;
  private cpuPercent = 0;
  private cache: Awaited<ReturnType<MonitoringService['collect']>> | null = null;
  private pending: Promise<Awaited<ReturnType<MonitoringService['collect']>>> | null = null;
  private cacheAt = 0;
  private disk: { total: number; used: number } | null = null;
  private diskCheckedAt = 0;
  private diskPending = false;
  private traffic: { interface: string | null; download: number | null; upload: number | null; checkedAt: string | null } = { interface: null, download: null, upload: null, checkedAt: null };
  private trafficPending = false;
  private interfaceName: string | null = null;
  readonly stream = timer(0, 1000).pipe(
    exhaustMap(() => this.snapshot().then((data) => ({ data })).catch(() => ({ data: { error: 'Monitoring sementara tidak tersedia.' } }))),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  constructor(private readonly prisma: PrismaService) {}
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupPending = false;

  onModuleInit() {
    void this.cleanupErrors();
    this.cleanupTimer = setInterval(() => void this.cleanupErrors(), 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async cleanupErrors() {
    if (this.cleanupPending) return;
    this.cleanupPending = true;
    try {
      await this.prisma.activityLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } } });
      await this.prisma.monitoringError.deleteMany({ where: {
        createdAt: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      } });
    } catch {
      console.error('Log kesalahan monitoring yang kedaluwarsa gagal dihapus.');
    } finally { this.cleanupPending = false; }
  }

  async activity(request: { method: string; body?: { namaTitik?: string; name?: string; customerName?: string }; params?: { id?: string; type?: string }; route?: { path?: string }; user?: { id: string; role: string } }, status: number, result?: { node?: { namaTitik?: string }; user?: { name?: string; role?: string } }) {
    if (request.method === 'GET') return;
    const route = String(request.route?.path ?? '');
    if (route.includes('monitoring')) return;
    try {
      const actor = request.user?.id ? await this.prisma.user.findUnique({ where: { id: BigInt(request.user.id) }, select: { name: true, role: true } }) : null;
      const module = route.includes('/auth') ? 'AUTH' : route.includes('/main-core') ? 'MAIN CORE' : route.includes('/pppoe') ? 'PPPOE' : route.includes('/users') ? 'PETUGAS' : 'LAINNYA';
      const action = route.endsWith('/login') ? 'LOGIN' : route.endsWith('/logout') ? 'LOGOUT' : request.method === 'POST' ? 'TAMBAH' : request.method === 'DELETE' ? 'HAPUS' : 'UBAH';
      const name = actor?.name ?? result?.user?.name ?? 'Pengunjung';
      const role = actor?.role ?? result?.user?.role ?? '-';
      let target = result?.node?.namaTitik ?? request.body?.namaTitik ?? request.body?.name ?? request.body?.customerName ?? request.params?.id ?? '';
      if (module === 'MAIN CORE' && !result?.node?.namaTitik && !request.body?.namaTitik && request.params?.id) {
        const node = await this.prisma.mainCore.findUnique({ where: { id: BigInt(request.params.id) }, select: { namaTitik: true } });
        target = node?.namaTitik ?? 'Core tidak ditemukan';
      }
      await this.prisma.activityLog.create({ data: {
        userName: name, role, module, action,
        description: (module === 'MAIN CORE' ? `${status < 400 ? 'Berhasil' : 'Gagal'} : ${target}` : `${action} ${request.params?.type ?? module} ${status < 400 ? 'berhasil' : 'gagal'}${target ? ': ' + String(target) : ''}`).slice(0, 500),
        status: status < 400 ? 'SUCCESS' : 'FAILED',
      } });
    } catch { console.error('Log aktivitas gagal disimpan.'); }
  }

  async activities(search = '', module = '', page = 1) {
    page = Math.max(1, Math.floor(Number(page) || 1));
    const where = { ...(module ? { module } : {}), ...(search ? { OR: ['userName', 'action', 'description'].map((field) => ({ [field]: { contains: search.slice(0, 255) } })) } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({ where, orderBy: { id: 'desc' }, take: 10, skip: (page - 1) * 10 }),
      this.prisma.activityLog.count({ where }),
    ]);
    return { data: data.map((log) => ({ ...log, id: log.id.toString() })), total, page, lastPage: Math.max(1, Math.ceil(total / 10)) };
  }

  async snapshot() {
    if (this.cache && Date.now() - this.cacheAt < 500) return this.cache;
    if (!this.pending) {
      this.pending = this.collect().then((result) => {
        this.cache = result;
        this.cacheAt = Date.now();
        return result;
      }).finally(() => { this.pending = null; });
    }
    return this.pending;
  }

  private refreshTraffic() {
    if (this.trafficPending) return;
    this.trafficPending = true;
    void (async () => {
      try {
        this.interfaceName ??= await networkInterfaceDefault();
        const [link] = await networkStats(this.interfaceName);
        const mbps = (value: number | undefined) => value != null && Number.isFinite(value) && value >= 0 ? value * 8 / 1_000_000 : null;
        this.traffic = { interface: link?.iface ?? null, download: mbps(link?.rx_sec), upload: mbps(link?.tx_sec), checkedAt: new Date().toISOString() };
      } catch {
        this.interfaceName = null;
        this.traffic = { interface: null, download: null, upload: null, checkedAt: null };
      } finally { this.trafficPending = false; }
    })();
  }

  private refreshDisk() {
    if (this.diskPending || Date.now() - this.diskCheckedAt < 30000) return;
    this.diskPending = true;
    void readLocalDiskTotals().then((disk) => {
      this.disk = disk;
    }).catch(() => { this.disk = null; }).finally(() => {
      this.diskCheckedAt = Date.now();
      this.diskPending = false;
    });
  }

  private cpuTotals() {
    return cpus().reduce((sum, cpu) => ({ idle: sum.idle + cpu.times.idle,
      total: sum.total + Object.values(cpu.times).reduce((a, b) => a + b, 0) }), { idle: 0, total: 0 });
  }

  private async collect() {
    const now = Date.now();
    if (now - this.sampledAt >= 1000) {
      const current = this.cpuTotals();
      const total = current.total - this.previous.total;
      this.cpuPercent = total > 0 ? Math.round((1 - (current.idle - this.previous.idle) / total) * 1000) / 10 : 0;
      this.previous = current;
      this.sampledAt = now;
    }
    this.refreshTraffic();
    this.refreshDisk();

    const total = totalmem();
    const used = total - freemem();
    return {
      checkedAt: new Date().toISOString(), hostname: hostname(), platform: platform(),
      cpu: { percent: this.cpuPercent, cores: cpus().length, model: cpus()[0]?.model ?? '-' },
      memory: { total, used, percent: Math.round(used / total * 1000) / 10 },
      disk: this.disk,
      traffic: this.traffic,
      network: Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
        (addresses ?? []).filter((address) => !address.internal && address.family === 'IPv4')
          .map((address) => ({ name, address: address.address }))),
      hostUptime: uptime(), appUptime: process.uptime(),
    };
  }
}

@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(private readonly monitoring: MonitoringService) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    // Simpan pola rute saja agar kueri, isi permintaan, dan kredensial tidak masuk log.
    const route = request.route?.path ?? '(unknown)';
    return next.handle().pipe(tap({
      next: (result) => { void this.monitoring.activity(request, response.statusCode, result); },
      error: (error) => void this.monitoring.activity(request, typeof error.getStatus === 'function' ? error.getStatus() : 500),
    }));
  }
}
