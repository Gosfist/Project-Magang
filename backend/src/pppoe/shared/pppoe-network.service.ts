import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { isIPv4 } from 'node:net';
import type { Radacct } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RadiusDisconnectService } from './radius-disconnect.service.js';
import { poolUsage } from '../ip-pools/pool-usage.js';
import { radiusLogTime } from '../../common/radius-log-time.js';

export interface NetworkResult { warnings: string[]; completed: number }
export type AccountingSession = Pick<Radacct, 'username' | 'nasipaddress' | 'acctsessionid'>;
export const accountingAckKey = (session: AccountingSession) => `radius_ack_${createHash('sha256').update(`${session.username}\0${session.nasipaddress}\0${session.acctsessionid}`).digest('hex')}`;
type Pending = { username: string; routerId: number; sessionId?: string; nasAddress?: string; requestedAt?: number };
export const accountingTime = (value: Date) => radiusLogTime(value, process.env.RADIUS_ACCOUNTING_TIMEZONE || process.env.RADIUS_LOG_TIMEZONE || 'WIB');
const unresolvedSessionMaxMs = 15 * 60 * 1000;
export const accountingFreshMs = () => {
  const seconds = Number(process.env.RADIUS_ACCOUNTING_STALE_SECONDS || 900);
  return (Number.isFinite(seconds) && seconds >= 60 ? seconds : 900) * 1000;
};

@Injectable()
export class PppoeNetworkService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PppoeNetworkService.name);
  private timer?: ReturnType<typeof setInterval>;
  private retrying = false;
  private readonly inflight = new Map<string, Promise<NetworkResult>>();
  constructor(private readonly prisma: PrismaService, private readonly radius: RadiusDisconnectService) {}
  onModuleInit() { this.timer = setInterval(() => void this.retryPending(), 60000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async accountPresence(accounts: { username: string; routerNasId: number | null }[]) {
    const states = new Map<string, boolean | null>(), uptimes = new Map<string, string | null>();
    if (!accounts.length) return { states, uptimes, warnings: [] as string[] };
    const [routers, sessions] = await Promise.all([
      this.prisma.nas.findMany({ where: { isActive: true }, select: { id: true, nasname: true } }),
      this.prisma.radacct.findMany({ where: { username: { in: [...new Set(accounts.map(row => row.username))] }, acctstoptime: null }, orderBy: { radacctid: 'desc' } }),
    ]);
    const markers = sessions.length ? await this.prisma.appSetting.findMany({ where: { key: { in: [...new Set(sessions.map(accountingAckKey))] } }, select: { key: true, value: true } }) : [];
    const acknowledgments = new Map(markers.map(row => [row.key, Number(row.value) * 1000]));
    const acknowledged = (row: typeof sessions[number]) => {
      const ackAt = acknowledgments.get(accountingAckKey(row));
      return ackAt !== undefined && Number.isFinite(ackAt) && !!row.acctstarttime && accountingTime(row.acctstarttime).getTime() <= ackAt;
    };
    let stale = false;
    for (const account of accounts) {
      const targets = routers.filter(router => account.routerNasId === null || router.id === account.routerNasId);
      const matching = sessions.filter(session => session.username === account.username && targets.some(router => router.nasname === session.nasipaddress) && !acknowledged(session));
      const session = matching.find(row => {
        const age = Date.now() - accountingTime(row.acctupdatetime ?? row.acctstarttime ?? new Date(0)).getTime();
        return age >= -1000 && age <= accountingFreshMs();
      });
      states.set(account.username, session ? true : matching.length || !targets.length ? null : false);
      uptimes.set(account.username, session ? `${session.acctsessiontime ?? Math.max(0, Math.floor((Date.now() - (session.acctstarttime ? accountingTime(session.acctstarttime).getTime() : Date.now())) / 1000))}s` : null);
      if (!session && matching.length) stale = true;
    }
    return { states, uptimes, warnings: stale ? ['Sebagian sesi accounting belum diperbarui; status ditampilkan tidak diketahui.'] : [] };
  }

  async listPools() {
    const pools = await this.prisma.ipPool.findMany({ include: { routerNas: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
    return { data: pools.map(pool => ({
      id: String(pool.id), routerNasId: pool.routerNasId, routerName: pool.routerNas?.name || pool.routerNas?.nasname || 'Belum ditetapkan',
      name: pool.name, ranges: `${pool.networkStart}-${pool.networkEnd}`, networkStart: pool.networkStart, networkEnd: pool.networkEnd,
      ...poolUsage(`${pool.networkStart}-${pool.networkEnd}`, null), source: 'registered', verified: false,
    })), warnings: ['Daftar pool adalah konfigurasi terdaftar. Pemasangan dan penggunaan IP pada router tidak diperiksa.'] };
  }
  openSessions(username: string) {
    return this.prisma.radacct.findMany({ where: { username, acctstoptime: null }, select: { username: true, nasipaddress: true, acctsessionid: true } });
  }
  async disconnect(username: string, routerNasId: number | null, captured?: AccountingSession[]): Promise<NetworkResult> {
    const requestedAt = Date.now();
    const sessions = captured ?? await this.openSessions(username);
    const addresses = [...new Set(sessions.map(row => row.nasipaddress))];
    const routers = await this.prisma.nas.findMany({ where: { OR: [
      ...(routerNasId !== null ? [{ id: routerNasId }] : []),
      { nasname: { in: addresses } },
    ] } });
    const result: NetworkResult = { warnings: [], completed: 0 }, jobs: Pending[] = [];
    for (const session of sessions) {
      const router = routers.find(row => row.nasname === session.nasipaddress);
      if (!router) { result.warnings.push('Sesi accounting berada pada NAS yang belum terdaftar; pemutusan belum terverifikasi.'); continue; }
      jobs.push({ username, routerId: router.id, sessionId: session.acctsessionid || undefined, nasAddress: session.nasipaddress, requestedAt });
    }
    if (routerNasId !== null && !jobs.some(job => job.routerId === routerNasId)) {
      const router = routers.find(row => row.id === routerNasId);
      if (router) jobs.push({ username, routerId: router.id, nasAddress: router.nasname, requestedAt });
    }
    if (!jobs.length) result.warnings.push('Tidak ada NAS/sesi yang dapat ditargetkan. Pemutusan belum terverifikasi.');
    const unique = [...new Map(jobs.map(job => [this.key(job), job])).values()];
    for (let start = 0; start < unique.length; start += 4) {
      const outcomes = await Promise.all(unique.slice(start, start + 4).map(job => this.deliver(job)));
      for (const outcome of outcomes) { result.completed += outcome.completed; result.warnings.push(...outcome.warnings); }
    }
    return result;
  }
  private key(job: Pending) {
    const identity = { username: job.username, routerId: job.routerId, sessionId: job.sessionId, nasAddress: job.nasAddress };
    return `radius_disconnect_${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`;
  }
  private deliver(job: Pending): Promise<NetworkResult> {
    const key = this.key(job), existing = this.inflight.get(key); if (existing) return existing;
    const promise = this.attempt(job, key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise); return promise;
  }
  private async attempt(job: Pending, key: string): Promise<NetworkResult> {
    const saved = await this.prisma.appSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(job) }, update: { updatedAt: new Date() } });
    try {
      // Repeated callers must not extend a no-session job's original action time.
      job = JSON.parse(saved.value) as Pending;
      const router = await this.prisma.nas.findUnique({ where: { id: job.routerId } });
      if (!router) throw new Error('NAS Disconnect tidak ditemukan.');
      if (!job.sessionId) {
        if (!Number.isFinite(job.requestedAt)) {
          await this.prisma.appSetting.deleteMany({ where: { key } });
          this.logger.warn('Antrean Disconnect tanpa waktu permintaan dibuang; sesi baru tidak ditargetkan.');
          return { warnings: ['Identitas sesi belum diketahui. Permintaan lama tanpa waktu tidak dapat diulang dengan aman.'], completed: 0 };
        }
        const sessions = await this.prisma.radacct.findMany({
          where: { username: job.username, nasipaddress: job.nasAddress || router.nasname, acctstoptime: null },
          select: { username: true, nasipaddress: true, acctsessionid: true, acctstarttime: true },
        });
        const identified = sessions.filter(row => row.acctsessionid && row.acctstarttime && Number.isFinite(accountingTime(row.acctstarttime).getTime()));
        const existing = identified.filter(row => accountingTime(row.acctstarttime!).getTime() <= job.requestedAt! + 1000);
        if (existing.length) {
          // Persist exact child jobs before clearing the unresolved parent, including on timeout.
          const outcomes = await Promise.all(existing.map(row => this.deliver({ username: job.username, routerId: router.id, nasAddress: row.nasipaddress, sessionId: row.acctsessionid, requestedAt: job.requestedAt })));
          await this.prisma.appSetting.deleteMany({ where: { key } });
          return { completed: outcomes.reduce((total, outcome) => total + outcome.completed, 0), warnings: outcomes.flatMap(outcome => outcome.warnings) };
        }
        if (identified.some(row => accountingTime(row.acctstarttime!).getTime() > job.requestedAt! + 1000)) {
          await this.prisma.appSetting.deleteMany({ where: { key } });
          this.logger.log('Antrean Disconnect lama selesai karena sesi baru sudah melakukan autentikasi ulang.');
          return { warnings: [], completed: 0 };
        }
        if (Date.now() - job.requestedAt! >= unresolvedSessionMaxMs) {
          await this.prisma.appSetting.deleteMany({ where: { key } });
          this.logger.warn('Antrean Disconnect kedaluwarsa setelah 15 menit tanpa identitas Accounting-Start.');
          return { warnings: ['Permintaan Disconnect kedaluwarsa tanpa identitas sesi accounting. Periksa Accounting-Start pada NAS.'], completed: 0 };
        }
        return { warnings: ['Menunggu identitas sesi dari Accounting-Start; pemutusan akan dicoba ulang.'], completed: 0 };
      }
      if (Number.isFinite(job.requestedAt) && Date.now() > job.requestedAt! + 1000) {
        const lifetimes = await this.prisma.radacct.findMany({
          where: { username: job.username, nasipaddress: job.nasAddress || router.nasname, acctsessionid: job.sessionId },
          select: { acctstarttime: true },
        });
        if (lifetimes.some(row => row.acctstarttime && accountingTime(row.acctstarttime).getTime() > job.requestedAt! + 1000)) {
          await this.prisma.appSetting.deleteMany({ where: { key } });
          this.logger.log('Antrean Disconnect lama dibatalkan karena ID sesi sudah dipakai koneksi baru.');
          return { warnings: [], completed: 0 };
        }
      }
      const reply = await this.radius.disconnect({ host: router.ipAddress || router.nasname, port: router.coaPort || 3799, secret: router.secret, username: job.username, sessionId: job.sessionId, nasAddress: job.nasAddress });
      // 503 means this session no longer exists; never fabricate Accounting-Stop.
      if (!reply.acknowledged && reply.errorCause !== 503) throw new Error(`NAS menolak Disconnect-Request${reply.errorCause ? ` (Error-Cause ${reply.errorCause})` : ''}.`);
      const ackKey = accountingAckKey({ username: job.username, nasipaddress: job.nasAddress || router.nasname, acctsessionid: job.sessionId });
      const ackAt = String(Math.floor(Date.now() / 1000));
      await this.prisma.appSetting.upsert({ where: { key: ackKey }, create: { key: ackKey, value: ackAt }, update: { value: ackAt } });
      await this.prisma.appSetting.deleteMany({ where: { key } });
      return { warnings: [], completed: 1 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Disconnect RADIUS gagal.';
      return { warnings: [`${message} Permintaan disimpan untuk dicoba ulang.`], completed: 0 };
    }
  }
  async retryPending() {
    if (this.retrying) return;
    this.retrying = true;
    try {
      await this.prisma.appSetting.deleteMany({ where: { key: { startsWith: 'radius_ack_' }, updatedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
      const pending = await this.prisma.appSetting.findMany({ where: { key: { startsWith: 'radius_disconnect_' } }, take: 100, orderBy: [{ updatedAt: 'asc' }, { key: 'asc' }] });
      for (let offset = 0; offset < pending.length; offset += 4) await Promise.all(pending.slice(offset, offset + 4).map(async row => {
        let job: Pending;
        try {
          job = JSON.parse(row.value);
          if (typeof job.username !== 'string' || !job.username || Buffer.byteLength(job.username) > 253 || !Number.isInteger(job.routerId) || job.routerId < 1
            || (job.sessionId !== undefined && (typeof job.sessionId !== 'string' || !job.sessionId || Buffer.byteLength(job.sessionId) > 253))
            || (job.nasAddress !== undefined && !isIPv4(job.nasAddress))
            || (job.requestedAt !== undefined && (!Number.isFinite(job.requestedAt) || job.requestedAt < 1)) || row.key !== this.key(job)) throw new Error();
        } catch {
          await this.prisma.appSetting.deleteMany({ where: { key: row.key } });
          this.logger.warn('Antrean Disconnect RADIUS tidak valid dibuang; payload tidak dicatat.');
          return;
        }
        await this.deliver(job);
      }));
    } catch { this.logger.warn('Antrean Disconnect RADIUS belum dapat diproses.'); }
    finally { this.retrying = false; }
  }
}
