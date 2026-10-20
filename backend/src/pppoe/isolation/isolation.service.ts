import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RadiusService } from '../shared/radius.service.js';
import { PppoeNetworkService, type AccountingSession } from '../shared/pppoe-network.service.js';
import { emptyIsolation, ipNumber, isolatedService, isolationKey, isolationProfile, ISOLATION_COMMENT, rangeIntervals, readIsolation, subnetBounds, type IsolationConfig } from '../shared/isolation-config.js';
import { ensurePoolScript, rosQuote } from '../shared/router-script.js';
import { SaveIsolationDto } from './isolation.dto.js';
import { createHash } from 'node:crypto';
import { internetPoolName, internetProfile, readNasNetwork } from '../../router/shared/nas-network.js';

type SyncJob = { status: 'running' | 'completed' | 'failed'; processed: number; reconnected: number; message: string };

@Injectable()
export class IsolationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IsolationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private refreshing = false;
  private readonly jobs = new Map<number, SyncJob>();
  private readonly locks = new Set<number>();
  constructor(private readonly prisma: PrismaService, private readonly network: PppoeNetworkService, private readonly radius: RadiusService) {}
  onModuleInit() { this.timer = setInterval(() => void this.refreshExpired(), 60000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async refreshExpired() {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const settings = await this.prisma.appSetting.findMany({ where: { key: { startsWith: 'pppoe_isolation_router_' } } });
      for (const setting of settings) {
        const routerId = Number(setting.key.slice('pppoe_isolation_router_'.length));
        if (!routerId || this.locks.has(routerId) || this.jobs.get(routerId)?.status === 'running') continue;
        const config = await this.stored(routerId);
        if (!config.enabled && !config.syncPending) continue;
        const job: SyncJob = { status: 'running', processed: 0, reconnected: 0, message: '' };
        this.jobs.set(routerId, job);
        await this.synchronize(routerId, config, config, job, false);
      }
    } catch { this.logger.error('Sinkronisasi masa aktif isolir tertunda. Periksa database dan NAS RADIUS.'); }
    finally { this.refreshing = false; }
  }
  private async router(routerId: number) {
    const router = await this.prisma.nas.findUnique({ where: { id: routerId } });
    if (!router?.isActive) throw new NotFoundException('Router aktif tidak ditemukan.');
    return router;
  }
  private async stored(routerId: number): Promise<IsolationConfig> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: isolationKey(routerId) } });
    if (!row) return emptyIsolation();
    try { return JSON.parse(row.value) as IsolationConfig; }
    catch { throw new BadRequestException('Pengaturan isolir tersimpan tidak valid.'); }
  }
  async get(routerId: number) {
    await this.router(routerId);
    const config = await this.stored(routerId);
    const pools = await this.prisma.ipPool.findMany({ where: { routerNasId: routerId } });
    return { config, pools: pools.map(pool => ({ name: pool.name, ranges: `${pool.networkStart}-${pool.networkEnd}` })),
      rules: [], ready: false, verification: 'manual', job: this.jobs.get(routerId) ?? null };
  }
  status(routerId: number) { return { job: this.jobs.get(routerId) ?? null }; }
  private async script(routerId: number, dto: SaveIsolationDto) {
    if (!dto.enabled) return '# Mode pool isolir dinonaktifkan di RADIUS. Rule drop lama tetap dipertahankan agar sesi yang belum reconnect tetap terblokir.\n# Jangan hapus rule sebelum memeriksa sesi lama pada router secara manual.';
    const [start, end] = subnetBounds(dto.subnet), local = ipNumber(dto.localAddress);
    if (local <= start || local >= end) throw new BadRequestException('IP gateway harus berada di dalam subnet isolir.');
    const pools = await this.prisma.ipPool.findMany({ where: { routerNasId: routerId } });
    const pool = pools.find(row => row.name === dto.poolName);
    if (!pool) throw new BadRequestException('Daftarkan IP Pool isolir pada NAS yang sama terlebih dahulu.');
    const ranges = rangeIntervals(`${pool.networkStart}-${pool.networkEnd}`);
    if (ranges.some(([a, b]) => a <= start || b >= end || a <= local && local <= b)) throw new BadRequestException('Rentang pool harus di dalam subnet tanpa network, broadcast atau gateway.');
    for (const other of pools.filter(row => row.id !== pool.id)) if (rangeIntervals(`${other.networkStart}-${other.networkEnd}`).some(([a, b]) => a <= end && start <= b)) throw new BadRequestException(`Subnet isolir tumpang tindih dengan pool terdaftar ${other.name}.`);
    const q = rosQuote, profile = q(isolationProfile(routerId));
    const commands = ['# Periksa subnet tidak tumpang tindih dengan jaringan interface/pool lain pada router.', '{',
      `:if ([:len [/ppp profile find where name=${profile}]] > 1) do={ :error "Profil isolir ganda"; };`,
      ...['OUT', 'IN', 'ROUTER'].map(tag => `:if ([:len [/ip firewall filter find where comment=${q(`${ISOLATION_COMMENT}${routerId}:${tag}`)}]] > 1) do={ :error "Rule isolir ganda; periksa manual"; };`),
      ensurePoolScript(pool),
      `:local profile [/ppp profile find where name=${profile}];`,
      ':if ([:len $profile] > 1) do={ :error "Profil isolir ganda"; };',
      `:if ([:len $profile] = 0) do={ /ppp profile add name=${profile} local-address=${q(dto.localAddress)} remote-address=${q(dto.poolName)} use-ipv6=no only-one=yes change-tcp-mss=yes session-timeout=0s idle-timeout=0s; } else={ /ppp profile set $profile local-address=${q(dto.localAddress)} remote-address=${q(dto.poolName)} use-ipv6=no only-one=yes change-tcp-mss=yes session-timeout=0s idle-timeout=0s; };`];
    for (const spec of [
      { chain: 'forward', field: 'src-address', tag: 'OUT' }, { chain: 'forward', field: 'dst-address', tag: 'IN' }, { chain: 'input', field: 'src-address', tag: 'ROUTER' },
    ]) {
      const comment = q(`${ISOLATION_COMMENT}${routerId}:${spec.tag}`);
      commands.push(`:local rule [/ip firewall filter find where comment=${comment}];`,
        ':if ([:len $rule] > 1) do={ :error "Rule isolir ganda; periksa manual"; };',
        `:if ([:len $rule] = 0) do={ /ip firewall filter add chain=${spec.chain} ${spec.field}=${q(dto.subnet)} action=drop comment=${comment}; } else={ /ip firewall filter set $rule chain=${spec.chain} ${spec.field}=${q(dto.subnet)} action=drop disabled=no; };`,
        `:if ([:len [/ip firewall filter find]] > 1) do={ /ip firewall filter move [find where comment=${comment}] 0; };`);
    }
    commands.push('}', '# Verifikasi tiga drop berada sebelum accept/FastTrack dan profil use-ipv6=no sebelum mengaktifkan di web.');
    return commands.join('\n');
  }
  async save(routerId: number, dto: SaveIsolationDto) {
    if (this.locks.has(routerId) || this.jobs.get(routerId)?.status === 'running') throw new ConflictException('Sinkronisasi router masih berjalan.');
    this.locks.add(routerId);
    try {
      await this.router(routerId);
      const previous = await this.stored(routerId);
      if (previous.syncPending && (previous.enabled !== dto.enabled || previous.poolName !== dto.poolName || previous.subnet !== dto.subnet || previous.localAddress !== dto.localAddress)) throw new ConflictException('Selesaikan Sinkron Ulang sebelum mengganti konfigurasi isolir.');
      if (previous.enabled && dto.enabled && (previous.poolName !== dto.poolName || previous.subnet !== dto.subnet || previous.localAddress !== dto.localAddress)) throw new BadRequestException('Nonaktifkan mode pool isolir dan tunggu sinkronisasi sebelum mengganti subnet/pool.');
      if (dto.enabled && await this.prisma.pppoePackage.count({ where: { OR: [{ addressPool: dto.poolName }, { ipPool: { name: dto.poolName } }] } })) throw new BadRequestException('Pool isolir tidak boleh dipakai sebagai pool internet harga paket.');
      const script = await this.script(routerId, dto);
      const scriptFingerprint = createHash('sha256').update(script).digest('hex');
      if (dto.enabled && dto.scriptInstalled !== true) return { message: 'Pasang dan periksa script pada NAS, lalu konfirmasi pemasangan untuk mengaktifkan isolir.', script, scriptFingerprint, requiresConfirmation: true, config: previous };
      if (dto.enabled && dto.scriptFingerprint !== scriptFingerprint) throw new ConflictException('Script atau data pool berubah. Buat dan pasang ulang script sebelum konfirmasi.');
      const config: IsolationConfig = { enabled: dto.enabled, poolName: dto.poolName, subnet: dto.subnet, localAddress: dto.localAddress, profileName: isolationProfile(routerId), syncPending: true };
      await this.prisma.appSetting.upsert({ where: { key: isolationKey(routerId) }, create: { key: isolationKey(routerId), value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
      this.start(routerId, config, previous);
      return { message: 'Pengaturan RADIUS disimpan; sinkronisasi dan Disconnect-Request berjalan. Konfigurasi router tidak diperiksa otomatis.', script, config, requiresConfirmation: false, job: this.jobs.get(routerId) };
    } finally { this.locks.delete(routerId); }
  }
  async sync(routerId: number) {
    await this.router(routerId);
    if (this.locks.has(routerId) || this.jobs.get(routerId)?.status === 'running') throw new ConflictException('Sinkronisasi masih berjalan.');
    const config = await this.stored(routerId);
    if (!config.profileName) throw new BadRequestException('Simpan konfigurasi isolir terlebih dahulu.');
    if (config.enabled) await readIsolation(this.prisma, routerId);
    this.start(routerId, config, config);
    return { message: 'Sinkronisasi RADIUS dimulai.', job: this.jobs.get(routerId) };
  }
  private start(routerId: number, config: IsolationConfig, previous: IsolationConfig) {
    const job: SyncJob = { status: 'running', processed: 0, reconnected: 0, message: '' };
    this.jobs.set(routerId, job); void this.synchronize(routerId, config, previous, job);
  }
  private async synchronize(routerId: number, config: IsolationConfig, previous: IsolationConfig, job: SyncJob, force = true) {
    try {
      let cursor = 0n;
      const network = await readNasNetwork(this.prisma, routerId);
      const expectedStates = new Map<string, { isolated: boolean; changed: boolean }>();
      while (true) {
        const accounts = await this.prisma.pppoeAccount.findMany({ where: { routerNasId: routerId, id: { gt: cursor } }, include: { package: { include: { ipPool: true } }, paymentPromises: { where: { status: 'ACTIVE' }, orderBy: { id: 'desc' }, take: 1 } }, orderBy: { id: 'asc' }, take: 100 });
        if (!accounts.length) break;
        const names = accounts.map(account => account.username);
        const replies = force ? [] : await this.prisma.radreply.findMany({ where: { username: { in: names }, attribute: { in: ['Framed-Pool', 'Mikrotik-Group', 'Mikrotik-Rate-Limit'] } } });
        const checks = force ? [] : await this.prisma.radcheck.findMany({ where: { username: { in: names }, attribute: { in: ['Cleartext-Password', 'Simultaneous-Use', 'Expiration'] } } });
        const replyMap = new Map(replies.map(row => [`${row.username}:${row.attribute}`, row.value])), checkMap = new Map(checks.map(row => [`${row.username}:${row.attribute}`, row.value]));
        for (const account of accounts) {
          let isolated = isolatedService(account, account.paymentPromises[0] ?? null);
          const pool = isolated && config.enabled ? config.poolName : network ? internetPoolName : account.package.ipPool?.name || account.package.addressPool;
          const current = config.enabled && !force && replyMap.get(`${account.username}:Framed-Pool`) === pool
            && replyMap.get(`${account.username}:Mikrotik-Group`) === (isolated ? config.profileName : network ? internetProfile(routerId) : undefined)
            && replyMap.get(`${account.username}:Mikrotik-Rate-Limit`) === `${account.package.uploadMbps}M/${account.package.downloadMbps}M`
            && checkMap.has(`${account.username}:Cleartext-Password`) && checkMap.get(`${account.username}:Simultaneous-Use`) === '1' && !checkMap.has(`${account.username}:Expiration`);
          if (!current) {
            const result = await this.prisma.$transaction(async tx => {
              const fresh = await tx.pppoeAccount.findUnique({ where: { id: account.id }, include: { package: { include: { ipPool: true } } } });
              if (!fresh || fresh.routerNasId !== routerId) return null;
              return this.radius.sync(tx, fresh);
            }, { timeout: 15000, isolationLevel: 'Serializable' });
            if (!result) { cursor = account.id; continue; }
            isolated = result.isolated;
          }
          expectedStates.set(account.username, { isolated, changed: !current }); cursor = account.id; job.processed++;
        }
      }
      const router = await this.router(routerId);
      const sessions = await this.prisma.radacct.findMany({ where: { acctstoptime: null, nasipaddress: router.nasname } });
      const subnet = config.subnet || previous.subnet, bounds = subnet ? subnetBounds(subnet) : null;
      const targets = new Map<string, AccountingSession[]>();
      for (const session of sessions) {
        const expected = expectedStates.get(session.username); if (!expected) continue;
        const inPool = !!bounds && !!session.framedipaddress && bounds[0] <= ipNumber(session.framedipaddress) && ipNumber(session.framedipaddress) <= bounds[1];
        const expectedPool = network ? expected.isolated ? network.isolation : network.internet : null;
        const ip = session.framedipaddress ? ipNumber(session.framedipaddress) : null;
        const mismatch = network && config.enabled
          ? config.syncPending || (ip !== null && expectedPool ? ip < ipNumber(expectedPool.start) || ip > ipNumber(expectedPool.end) : expected.changed)
          : config.enabled ? (session.framedipaddress ? expected.isolated !== inPool : expected.changed) : expected.isolated || inPool;
        if (mismatch) targets.set(session.username, [...(targets.get(session.username) || []), session]);
      }
      const warnings: string[] = [], entries = [...targets];
      for (let offset = 0; offset < entries.length; offset += 4) {
        const results = await Promise.all(entries.slice(offset, offset + 4).map(([username, rows]) => this.network.disconnect(username, null, rows)));
        for (const result of results) { job.reconnected += result.completed; warnings.push(...result.warnings); }
      }
      if (warnings.length) throw new Error(warnings.join(' '));
      await this.prisma.appSetting.update({ where: { key: isolationKey(routerId) }, data: { value: JSON.stringify({ ...config, syncPending: false }) } });
      job.status = 'completed'; job.message = 'Sinkronisasi RADIUS selesai. IP berubah setelah pelanggan reconnect; pemasangan router tetap diverifikasi manual.';
    } catch (error) { job.status = 'failed'; job.message = `Sinkronisasi tertunda. ${error instanceof Error ? error.message : 'Periksa RADIUS dan koneksi NAS.'} Akan dicoba ulang secara berkala.`; }
  }
}
