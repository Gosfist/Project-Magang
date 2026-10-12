import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MikrotikService, type RouterCommand } from '../../router/shared/mikrotik.service.js';
import { RadiusService } from '../shared/radius.service.js';
import { emptyIsolation, ipNumber, isolatedService, isolationKey, isolationProfile, ISOLATION_COMMENT, rangeIntervals, readIsolation, subnetBounds, type IsolationConfig } from '../shared/isolation-config.js';
import { SaveIsolationDto } from './isolation.dto.js';

type SyncJob = { status: 'running' | 'completed' | 'failed'; processed: number; reconnected: number; message: string };

@Injectable()
export class IsolationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IsolationService.name);
  private timer?: ReturnType<typeof setInterval>;
  private refreshing = false;
  private readonly jobs = new Map<number, SyncJob>();
  private readonly locks = new Set<number>();
  constructor(private readonly prisma: PrismaService, private readonly mikrotik: MikrotikService, private readonly radius: RadiusService) {}
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
    } catch (error) { this.logger.error(`Sinkronisasi masa aktif isolir: ${this.mikrotik.errorMessage(error)}`); }
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
    const router = await this.router(routerId);
    const config = await this.stored(routerId);
    try {
      return await this.mikrotik.withRouter(router, async write => {
        const pools = await write('/ip/pool/print', ['=.proplist=name,ranges,next-pool']);
        const rules = await write('/ip/firewall/filter/print');
        const profiles = await write('/ppp/profile/print', [`?name=${isolationProfile(routerId)}`]);
        const managed = rules.filter(row => row.comment?.startsWith(`${ISOLATION_COMMENT}${routerId}:`));
        const expected = this.ruleSpecs(routerId, config.subnet);
        const firstOrdinary = rules.findIndex(row => row.dynamic !== 'true' && !row.comment?.startsWith(ISOLATION_COMMENT));
        const firewallReady = expected.every(spec => {
          const index = rules.findIndex(row => row.comment === spec.comment && row.chain === spec.chain && row.action === 'drop' && row[spec.field] === config.subnet && row.disabled !== 'true');
          return index >= 0 && (firstOrdinary < 0 || index < firstOrdinary);
        });
        const poolReady = pools.some(row => row.name === config.poolName);
        const profileReady = profiles.some(row => row.name === config.profileName && row['use-ipv6'] === 'no' && row['remote-address'] === config.poolName && row['local-address'] === config.localAddress);
        return { config, pools, rules: managed, ready: config.enabled && firewallReady && poolReady && profileReady, job: this.jobs.get(routerId) ?? null };
      });
    } catch (error) { throw new BadGatewayException(this.mikrotik.errorMessage(error)); }
  }
  status(routerId: number) { return { job: this.jobs.get(routerId) ?? null }; }
  private ruleSpecs(routerId: number, subnet: string) {
    return [
      { chain: 'forward', field: 'src-address', comment: `${ISOLATION_COMMENT}${routerId}:OUT`, subnet },
      { chain: 'forward', field: 'dst-address', comment: `${ISOLATION_COMMENT}${routerId}:IN`, subnet },
      { chain: 'input', field: 'src-address', comment: `${ISOLATION_COMMENT}${routerId}:ROUTER`, subnet },
    ];
  }
  private async install(write: RouterCommand, routerId: number, dto: SaveIsolationDto, alreadyEnabled = false) {
    const [start, end] = subnetBounds(dto.subnet);
    const local = ipNumber(dto.localAddress);
    if (local <= start || local >= end) throw new BadRequestException('IP gateway harus berada di dalam subnet isolir.');
    const pools = await write('/ip/pool/print', ['=.proplist=.id,name,ranges,next-pool']);
    const pool = pools.find(row => row.name === dto.poolName);
    if (!pool) throw new BadRequestException('Buat atau pilih IP Pool isolir pada router yang sama.');
    if (pool['next-pool'] && pool['next-pool'] !== 'none') throw new BadRequestException('Pool isolir tidak boleh memiliki next-pool agar tidak keluar subnet.');
    const ranges = rangeIntervals(pool.ranges);
    if (ranges.some(([a, b]) => a <= start || b >= end || (a <= local && local <= b))) throw new BadRequestException('Rentang pool harus berada dalam subnet, tanpa IP network, broadcast, atau gateway.');
    for (const other of pools.filter(row => row.name !== dto.poolName)) {
      if (rangeIntervals(other.ranges).some(([a, b]) => a <= end && start <= b)) throw new BadRequestException(`Subnet isolir tumpang tindih dengan pool ${other.name}.`);
    }
    const addresses = await write('/ip/address/print', ['=.proplist=address,dynamic']);
    if (addresses.some(row => {
      // Existing isolated PPP sessions publish this gateway as a dynamic /32.
      if (alreadyEnabled && row.dynamic === 'true' && row.address === `${dto.localAddress}/32`) return false;
      const [ip, prefix] = row.address.split('/');
      const size = 2 ** (32 - Number(prefix));
      const a = Math.floor(ipNumber(ip) / size) * size;
      return a <= end && start <= a + size - 1;
    })) throw new BadRequestException('Subnet isolir tumpang tindih dengan jaringan interface router. Gunakan subnet terpisah.');
    const profileName = isolationProfile(routerId);
    const profiles = await write('/ppp/profile/print', [`?name=${profileName}`, '=.proplist=.id,name']);
    const profile = profiles.find(row => row.name === profileName);
    const words = [`=local-address=${dto.localAddress}`, `=remote-address=${dto.poolName}`, '=use-ipv6=no', '=only-one=yes', '=change-tcp-mss=yes', '=session-timeout=0s', '=idle-timeout=0s'];
    if (profile) await write('/ppp/profile/set', [`=.id=${profile['.id']}`, ...words]);
    else await write('/ppp/profile/add', [`=name=${profileName}`, ...words]);
    // Insert/move each managed drop before every ordinary filter, including FastTrack.
    for (const spec of this.ruleSpecs(routerId, dto.subnet).reverse()) {
      const rows = await write('/ip/firewall/filter/print');
      const existing = rows.filter(row => row.comment === spec.comment);
      const fields = [`=chain=${spec.chain}`, '=action=drop', `=${spec.field}=${dto.subnet}`, `=comment=${spec.comment}`, '=disabled=no'];
      await write('/ip/firewall/filter/add', fields);
      const updated = await write('/ip/firewall/filter/print');
      const item = updated.find(row => row.comment === spec.comment && !existing.some(old => old['.id'] === row['.id']));
      if (!item) throw new BadGatewayException('Không thể xác minh rule isolir mới.');
      const first = updated.find(row => row.dynamic !== 'true' && row['.id'] !== item['.id']);
      if (first) await write('/ip/firewall/filter/move', [`=.id=${item['.id']}`, `=destination=${first['.id']}`]);
      for (const old of existing) await write('/ip/firewall/filter/remove', [`=.id=${old['.id']}`]);
    }
  }
  async save(routerId: number, dto: SaveIsolationDto) {
    if (this.locks.has(routerId) || this.jobs.get(routerId)?.status === 'running') throw new ConflictException('Sinkronisasi router masih berjalan.');
    this.locks.add(routerId);
    try {
      const router = await this.router(routerId), previous = await this.stored(routerId);
      if (previous.syncPending && (previous.enabled !== dto.enabled || previous.poolName !== dto.poolName || previous.subnet !== dto.subnet || previous.localAddress !== dto.localAddress)) throw new ConflictException('Selesaikan Sinkron Ulang sebelum mengganti konfigurasi isolir.');
      if (previous.enabled && dto.enabled && (previous.poolName !== dto.poolName || previous.subnet !== dto.subnet || previous.localAddress !== dto.localAddress)) throw new BadRequestException('Nonaktifkan mode pool isolir dan tunggu sinkronisasi selesai sebelum mengganti subnet/pool.');
      if (dto.enabled) {
        if (await this.prisma.pppoePackage.count({ where: { OR: [{ addressPool: dto.poolName }, { ipPool: { name: dto.poolName } }] } })) throw new BadRequestException('Pool isolir tidak boleh dipakai sebagai pool internet harga paket.');
        try { await this.mikrotik.withRouter(router, write => this.install(write, routerId, dto, previous.enabled), 60000); }
        catch (error) { if (error instanceof BadRequestException) throw error; throw new BadGatewayException(this.mikrotik.errorMessage(error)); }
      }
      const config: IsolationConfig = { ...dto, profileName: isolationProfile(routerId), syncPending: true };
      await this.prisma.appSetting.upsert({ where: { key: isolationKey(routerId) }, create: { key: isolationKey(routerId), value: JSON.stringify(config) }, update: { value: JSON.stringify(config) } });
      this.start(routerId, config, previous);
      return { message: 'Pengaturan diterapkan. Sinkronisasi akun dan pemindahan sesi sedang berjalan.', job: this.jobs.get(routerId) };
    } finally { this.locks.delete(routerId); }
  }
  async sync(routerId: number) {
    await this.router(routerId);
    if (this.locks.has(routerId) || this.jobs.get(routerId)?.status === 'running') throw new ConflictException('Sinkronisasi masih berjalan.');
    const config = await this.stored(routerId);
    if (!config.profileName) throw new BadRequestException('Terapkan konfigurasi isolir terlebih dahulu.');
    if (config.enabled) await readIsolation(this.prisma, routerId);
    this.start(routerId, config, config);
    return { message: 'Sinkronisasi dimulai.', job: this.jobs.get(routerId) };
  }
  private start(routerId: number, config: IsolationConfig, previous: IsolationConfig) {
    const job: SyncJob = { status: 'running', processed: 0, reconnected: 0, message: '' };
    this.jobs.set(routerId, job);
    void this.synchronize(routerId, config, previous, job);
  }
  private async synchronize(routerId: number, config: IsolationConfig, previous: IsolationConfig, job: SyncJob, force = true) {
    try {
      let cursor = 0n;
      const expectedStates = new Map<string, boolean>();
      while (true) {
        const accounts = await this.prisma.pppoeAccount.findMany({ where: { routerNasId: routerId, id: { gt: cursor } }, include: { package: { include: { ipPool: true } }, paymentPromises: { where: { status: 'ACTIVE' }, orderBy: { id: 'desc' }, take: 1 } }, orderBy: { id: 'asc' }, take: 100 });
        if (!accounts.length) break;
        const names = accounts.map(account => account.username);
        const replies = force ? [] : await this.prisma.radreply.findMany({ where: { username: { in: names }, attribute: { in: ['Framed-Pool', 'Mikrotik-Group', 'Mikrotik-Rate-Limit'] } } });
        const checks = force ? [] : await this.prisma.radcheck.findMany({ where: { username: { in: names }, attribute: { in: ['Cleartext-Password', 'Simultaneous-Use', 'Expiration'] } } });
        const replyMap = new Map(replies.map(row => [`${row.username}:${row.attribute}`, row.value]));
        const checkMap = new Map(checks.map(row => [`${row.username}:${row.attribute}`, row.value]));
        for (const account of accounts) {
          let isolated = isolatedService(account, account.paymentPromises[0] ?? null);
          const pool = isolated && config.enabled ? config.poolName : account.package.ipPool?.name || account.package.addressPool;
          const current = config.enabled && !force && replyMap.get(`${account.username}:Framed-Pool`) === pool
            && replyMap.get(`${account.username}:Mikrotik-Group`) === (isolated ? config.profileName : undefined)
            && replyMap.get(`${account.username}:Mikrotik-Rate-Limit`) === `${account.package.uploadMbps}M/${account.package.downloadMbps}M`
            && checkMap.has(`${account.username}:Cleartext-Password`) && checkMap.get(`${account.username}:Simultaneous-Use`) === '1'
            && !checkMap.has(`${account.username}:Expiration`);
          if (!current) {
            const result = await this.prisma.$transaction(async tx => {
              const fresh = await tx.pppoeAccount.findUnique({ where: { id: account.id }, include: { package: { include: { ipPool: true } } } });
              if (!fresh || fresh.routerNasId !== routerId) return null;
              return this.radius.sync(tx, fresh);
            }, { timeout: 15000, isolationLevel: 'Serializable' });
            if (result) isolated = result.isolated;
          }
          expectedStates.set(account.username, isolated);
          cursor = account.id; job.processed++;
        }
      }
      const router = await this.router(routerId);
      await this.mikrotik.withRouter(router, async write => {
        const sessions = await write('/ppp/active/print', ['=.proplist=.id,name,address,service']);
        const subnet = config.subnet || previous.subnet;
        const bounds = subnet ? subnetBounds(subnet) : null;
        for (const session of sessions.filter(row => row.service === 'pppoe')) {
          const address = ipNumber(session.address || '0.0.0.0');
          const inPool = !!bounds && bounds[0] <= address && address <= bounds[1];
          if (!expectedStates.has(session.name)) continue;
          const shouldIsolate = expectedStates.get(session.name)!;
          if ((config.enabled ? shouldIsolate !== inPool : shouldIsolate || inPool) && session['.id']) {
            await write('/ppp/active/remove', [`=.id=${session['.id']}`]); job.reconnected++;
          }
        }
        if (!config.enabled) {
          const rules = await write('/ip/firewall/filter/print');
          for (const rule of rules.filter(row => row.comment?.startsWith(`${ISOLATION_COMMENT}${routerId}:`))) await write('/ip/firewall/filter/remove', [`=.id=${rule['.id']}`]);
        }
      }, 60000);
      await this.prisma.appSetting.update({ where: { key: isolationKey(routerId) }, data: { value: JSON.stringify({ ...config, syncPending: false }) } });
      job.status = 'completed'; job.message = 'Sinkronisasi selesai. IP baru diterapkan saat sesi tersambung kembali.';
    } catch (error) { job.status = 'failed'; job.message = `Sinkronisasi belum selesai. ${this.mikrotik.errorMessage(error)} Jalankan Sinkron Ulang.`; }
  }
}
