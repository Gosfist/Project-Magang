import { accountingAckKey, accountingTime, PppoeNetworkService, type AccountingSession } from './pppoe-network.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { RadiusDisconnectService } from './radius-disconnect.service.js';

describe('PPPoE RADIUS accounting and Disconnect', () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const router = { id: 3, name: 'NAS 3', nasname: '10.99.0.2', ipAddress: '10.99.0.2', coaPort: 3799, secret: 'synthetic-test-secret' };
  const session = (username = 'andi', address = router.nasname, ageSeconds = 60) => ({ username, nasipaddress: address, acctsessionid: 'session-A', acctupdatetime: new Date(now.getTime() - ageSeconds * 1000), acctstarttime: new Date(now.getTime() - 3600000), acctsessiontime: 3600 });
  function setup() {
    const queue = new Map<string, string>();
    const updated = new Map<string, Date>();
    const prisma = {
      nas: { findMany: vi.fn().mockResolvedValue([router]), findUnique: vi.fn().mockResolvedValue(router) },
      radacct: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      ipPool: { findMany: vi.fn().mockResolvedValue([]) },
      appSetting: {
        upsert: vi.fn().mockImplementation(async ({ where, create, update }) => {
          if (!queue.has(where.key)) queue.set(where.key, create.value);
          else if (update.value !== undefined) queue.set(where.key, update.value);
          updated.set(where.key, update.updatedAt || new Date());
          return { key: where.key, value: queue.get(where.key), updatedAt: updated.get(where.key) };
        }),
        deleteMany: vi.fn().mockImplementation(async ({ where }) => {
          const keys = [...queue.keys()].filter(key => typeof where.key === 'string' ? key === where.key : key.startsWith(where.key.startsWith));
          for (const key of keys) if (!where.updatedAt?.lt || (updated.get(key) || new Date(0)) < where.updatedAt.lt) { queue.delete(key); updated.delete(key); }
          return { count: keys.length };
        }),
        findMany: vi.fn().mockImplementation(async ({ where, take }) => [...queue].map(([key, value]) => ({ key, value, updatedAt: updated.get(key) || new Date(0) }))
          .filter(row => where.key.in ? where.key.in.includes(row.key) : row.key.startsWith(where.key.startsWith))
          .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime() || a.key.localeCompare(b.key)).slice(0, take)),
      },
    };
    const radius = { disconnect: vi.fn().mockResolvedValue({ acknowledged: true }) };
    return { service: new PppoeNetworkService(prisma as unknown as PrismaService, radius as unknown as RadiusDisconnectService), prisma, radius, queue, pending: () => [...queue].filter(([key]) => key.startsWith('radius_disconnect_')) };
  }
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv('RADIUS_ACCOUNTING_STALE_SECONDS', '900'); vi.stubEnv('RADIUS_ACCOUNTING_TIMEZONE', 'UTC'); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it('reads fresh accounting by exact username and assigned NAS, with stale sessions unknown', async () => {
    const { service, prisma } = setup();
    prisma.radacct.findMany.mockResolvedValue([session(), session('stale', router.nasname, 901), session('foreign', '10.99.0.4')]);
    const result = await service.accountPresence(['andi', 'and', 'stale', 'foreign'].map(username => ({ username, routerNasId: 3 })));
    expect(result.states.get('andi')).toBe(true); expect(result.uptimes.get('andi')).toBe('3600s');
    expect(result.states.get('and')).toBe(false);
    expect(result.states.get('stale')).toBeNull(); expect(result.uptimes.get('stale')).toBeNull();
    expect(result.states.get('foreign')).toBe(false);
    expect(result.warnings).toEqual(['Sebagian sesi accounting belum diperbarui; status ditampilkan tidak diketahui.']);
    expect(prisma.radacct.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { username: { in: ['andi', 'and', 'stale', 'foreign'] }, acctstoptime: null } }));
  });
  it('does not borrow a session on another registered NAS for an assigned account', async () => {
    const { service, prisma } = setup();
    prisma.nas.findMany.mockResolvedValue([router, { ...router, id: 4, nasname: '10.99.0.4', ipAddress: '10.99.0.4' }]);
    prisma.radacct.findMany.mockResolvedValue([session('andi', '10.99.0.4')]);
    expect((await service.accountPresence([{ username: 'andi', routerNasId: 3 }])).states.get('andi')).toBe(false);
    expect((await service.accountPresence([{ username: 'andi', routerNasId: null }])).states.get('andi')).toBe(true);
    expect((await service.accountPresence([{ username: 'andi', routerNasId: 99 }])).states.get('andi')).toBeNull();
  });
  it('uses the newest fresh session rather than an older stale accounting record', async () => {
    const { service, prisma } = setup();
    prisma.radacct.findMany.mockResolvedValue([session('andi', router.nasname, 1000), { ...session(), acctsessiontime: null, acctupdatetime: null, acctstarttime: new Date(now.getTime() - 120000) }]);
    const result = await service.accountPresence([{ username: 'andi', routerNasId: 3 }]);
    expect(result.states.get('andi')).toBe(true); expect(result.uptimes.get('andi')).toBe('120s'); expect(result.warnings).toEqual([]);
  });
  it('keeps a UTC accounting update from 19 seconds ago online on a WIB display', async () => {
    vi.setSystemTime(new Date('2026-10-20T09:49:30Z'));
    const { service, prisma } = setup();
    prisma.radacct.findMany.mockResolvedValue([{ ...session('wisnu'), acctstarttime: new Date('2026-10-20T09:44:11Z'),
      acctupdatetime: new Date('2026-10-20T09:49:11Z'), acctsessiontime: 300 }]);
    vi.stubEnv('RADIUS_ACCOUNTING_TIMEZONE', 'UTC');
    expect((await service.accountPresence([{ username: 'wisnu', routerNasId: 3 }])).states.get('wisnu')).toBe(true);
    vi.stubEnv('RADIUS_ACCOUNTING_TIMEZONE', 'WIB');
    expect((await service.accountPresence([{ username: 'wisnu', routerNasId: 3 }])).states.get('wisnu')).toBeNull();
  });
  it('does not query the database for an empty presence request', async () => {
    const { service, prisma } = setup();
    expect((await service.accountPresence([])).states.size).toBe(0);
    expect(prisma.nas.findMany).not.toHaveBeenCalled(); expect(prisma.radacct.findMany).not.toHaveBeenCalled();
  });
  it('returns registered pool sizes with unknown live usage', async () => {
    const { service, prisma, radius } = setup();
    prisma.ipPool.findMany.mockResolvedValue([{ id: 12n, routerNasId: 3, routerNas: router, name: 'customers', networkStart: '10.0.0.1', networkEnd: '10.0.0.3' }]);
    const result = await service.listPools();
    expect(result.data).toEqual([expect.objectContaining({ id: '12', routerNasId: 3, routerName: 'NAS 3', totalIps: 3, usedIps: null, freeIps: null, source: 'registered', verified: false })]);
    expect(result.warnings).toHaveLength(1); expect(radius.disconnect).not.toHaveBeenCalled();
  });
  it('sends Disconnect to the accounting NAS with the exact session ID and does not invent Accounting-Stop', async () => {
    const { service, prisma, radius, pending } = setup();
    prisma.radacct.findMany.mockResolvedValue([session(), session()]);
    const result = await service.disconnect('andi', 3);
    expect(radius.disconnect).toHaveBeenCalledTimes(1);
    expect(radius.disconnect).toHaveBeenCalledWith({ host: router.ipAddress, port: 3799, secret: router.secret, username: 'andi', sessionId: 'session-A', nasAddress: router.nasname });
    expect(result).toEqual({ warnings: [], completed: 1 }); expect(pending()).toHaveLength(0);
    expect(prisma.radacct.updateMany).not.toHaveBeenCalled();
  });
  it('targets captured old accounting sessions after an account change without re-reading them', async () => {
    const { service, prisma, radius } = setup();
    const captured: AccountingSession[] = [{ username: 'old-name', nasipaddress: router.nasname, acctsessionid: 'old-session' }];
    await service.disconnect('old-name', null, captured);
    expect(prisma.radacct.findMany).not.toHaveBeenCalled();
    expect(radius.disconnect).toHaveBeenCalledWith(expect.objectContaining({ username: 'old-name', sessionId: 'old-session' }));
  });
  it('does not broadcast unknown or unassigned sessions to registered routers', async () => {
    const { service, prisma, radius } = setup();
    prisma.radacct.findMany.mockResolvedValue([session('andi', '10.200.0.99')]);
    const result = await service.disconnect('andi', null);
    expect(result.completed).toBe(0); expect(result.warnings.join(' ')).toContain('NAS yang belum terdaftar');
    expect(radius.disconnect).not.toHaveBeenCalled();
    prisma.radacct.findMany.mockResolvedValue([]);
    expect((await service.disconnect('andi', null)).warnings.join(' ')).toContain('Tidak ada NAS/sesi');
    expect(radius.disconnect).not.toHaveBeenCalled();
  });
  it('waits for an exact Accounting-Start identity rather than sending a wildcard username request', async () => {
    const { service, radius, pending } = setup();
    const result = await service.disconnect('andi', 3);
    expect(radius.disconnect).not.toHaveBeenCalled();
    expect(result.completed).toBe(0); expect(result.warnings[0]).toContain('Accounting-Start');
    expect(pending()).toHaveLength(1);
    expect(JSON.parse(pending()[0][1])).toEqual({ username: 'andi', routerId: 3, nasAddress: router.nasname, requestedAt: now.getTime() });
  });
  it.each(['timeout', 'nak'])('persists a %s failure and retries the same session until acknowledged', async failure => {
    const { service, prisma, radius, pending } = setup();
    prisma.radacct.findMany.mockResolvedValue([session()]);
    if (failure === 'timeout') radius.disconnect.mockRejectedValueOnce(new Error('Disconnect timeout'));
    else radius.disconnect.mockResolvedValueOnce({ acknowledged: false, errorCause: 506 });
    const first = await service.disconnect('andi', 3);
    expect(first.completed).toBe(0); expect(first.warnings[0]).toContain('dicoba ulang'); expect(pending()).toHaveLength(1);
    expect(prisma.appSetting.deleteMany).not.toHaveBeenCalled();
    const queued = JSON.parse(pending()[0][1]);
    expect(queued).toEqual({ username: 'andi', routerId: 3, sessionId: 'session-A', nasAddress: router.nasname, requestedAt: now.getTime() });
    expect(queued.secret).toBeUndefined();
    await service.retryPending();
    expect(radius.disconnect).toHaveBeenCalledTimes(2); expect(pending()).toHaveLength(0);
    expect(radius.disconnect.mock.calls[1][0]).toEqual(radius.disconnect.mock.calls[0][0]);
    expect(prisma.radacct.updateMany).not.toHaveBeenCalled();
  });
  it('accepts Session-Context-Not-Found as already disconnected without fabricating accounting', async () => {
    const { service, prisma, radius, pending } = setup();
    prisma.radacct.findMany.mockResolvedValue([session()]);
    radius.disconnect.mockResolvedValue({ acknowledged: false, errorCause: 503 });
    expect(await service.disconnect('andi', 3)).toEqual({ completed: 1, warnings: [] });
    expect(pending()).toHaveLength(0); expect(prisma.radacct.updateMany).not.toHaveBeenCalled();
  });

  it('normalizes WIB accounting wall time and never keeps a future timestamp online', async () => {
    vi.stubEnv('RADIUS_ACCOUNTING_TIMEZONE', 'WIB');
    const { service, prisma } = setup();
    const rawWallTime = (age: number) => new Date(now.getTime() + 7 * 3600000 - age * 1000);
    prisma.radacct.findMany.mockResolvedValue([
      { ...session('fresh'), acctupdatetime: rawWallTime(60), acctstarttime: rawWallTime(3600) },
      { ...session('stale'), acctupdatetime: rawWallTime(901), acctstarttime: rawWallTime(3600) },
      { ...session('future'), acctupdatetime: rawWallTime(-600), acctstarttime: rawWallTime(-600) },
    ]);
    const result = await service.accountPresence(['fresh', 'stale', 'future'].map(username => ({ username, routerNasId: 3 })));
    expect(result.states.get('fresh')).toBe(true);
    expect(result.states.get('stale')).toBeNull();
    expect(result.states.get('future')).toBeNull();
    expect(accountingTime(rawWallTime(0)).getTime()).toBe(now.getTime());
    vi.stubEnv('RADIUS_ACCOUNTING_TIMEZONE', ''); vi.stubEnv('RADIUS_LOG_TIMEZONE', 'WIB');
    expect(accountingTime(rawWallTime(0)).getTime()).toBe(now.getTime());
  });

  it('resolves a delayed Accounting-Start only to the session existing before the action', async () => {
    const { service, prisma, radius, pending } = setup();
    await service.disconnect('andi', 3);
    vi.setSystemTime(new Date(now.getTime() + 60000));
    prisma.radacct.findMany.mockResolvedValue([session()]);
    await service.retryPending();
    expect(radius.disconnect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ username: 'andi', sessionId: 'session-A', nasAddress: router.nasname }));
    expect(pending()).toHaveLength(0);
  });

  it('preserves the original fallback time across repeated calls and leaves new healthy sessions untouched', async () => {
    const { service, prisma, radius, pending } = setup();
    await service.disconnect('andi', 3);
    const originalKey = pending()[0][0];
    vi.setSystemTime(new Date(now.getTime() + 60000));
    await service.disconnect('andi', 3);
    expect(pending()).toHaveLength(1); expect(pending()[0][0]).toBe(originalKey);
    expect(JSON.parse(pending()[0][1]).requestedAt).toBe(now.getTime());
    prisma.radacct.findMany.mockResolvedValue([{ ...session(), acctsessionid: 'new-healthy', acctstarttime: new Date(now.getTime() + 30000) }]);
    await service.retryPending();
    expect(radius.disconnect).not.toHaveBeenCalled(); expect(pending()).toHaveLength(0);
  });

  it('discards unresolved requests after 15 minutes without sending any broad Disconnect', async () => {
    const { service, radius, pending } = setup();
    await service.disconnect('andi', 3);
    vi.setSystemTime(new Date(now.getTime() + 15 * 60000));
    await service.retryPending();
    expect(radius.disconnect).not.toHaveBeenCalled(); expect(pending()).toHaveLength(0);
  });

  it('retains an exact child outbox entry if resolving delayed accounting times out', async () => {
    const { service, prisma, radius, pending } = setup();
    await service.disconnect('andi', 3);
    prisma.radacct.findMany.mockResolvedValue([session()]);
    radius.disconnect.mockRejectedValueOnce(new Error('Disconnect timeout'));
    await service.retryPending();
    expect(pending()).toHaveLength(1);
    expect(JSON.parse(pending()[0][1])).toEqual({ username: 'andi', routerId: 3, nasAddress: router.nasname, sessionId: 'session-A', requestedAt: now.getTime() });
    await service.disconnect('andi', 3);
    expect(pending()).toHaveLength(0);
    expect(radius.disconnect).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])('records signed ACK/503 evidence without a fake stop and reports acknowledged sessions offline (%s)', async acknowledged => {
    const { service, prisma, radius, queue, pending } = setup();
    const active = session();
    prisma.radacct.findMany.mockResolvedValue([active]);
    radius.disconnect.mockResolvedValue(acknowledged ? { acknowledged: true } : { acknowledged: false, errorCause: 503 });
    await service.disconnect('andi', 3);
    const markerKey = accountingAckKey(active);
    expect(queue.get(markerKey)).toBe(String(now.getTime() / 1000));
    expect(pending()).toHaveLength(0);
    expect((await service.accountPresence([{ username: 'andi', routerNasId: 3 }])).states.get('andi')).toBe(false);
    expect(prisma.radacct.updateMany).not.toHaveBeenCalled();
    vi.setSystemTime(new Date(now.getTime() + 60000));
    prisma.radacct.findMany.mockResolvedValue([{ ...active, acctstarttime: new Date(now.getTime() + 30000), acctupdatetime: new Date(now.getTime() + 60000) }]);
    expect((await service.accountPresence([{ username: 'andi', routerNasId: 3 }])).states.get('andi')).toBe(true);
  });

  it('retries oldest attempted jobs first and cleans old acknowledgment markers', async () => {
    const { service, prisma, queue } = setup();
    await service.disconnect('andi', 3);
    const oldMarker = accountingAckKey({ username: 'old', nasipaddress: router.nasname, acctsessionid: 'old-session' });
    queue.set(oldMarker, String(now.getTime() / 1000 - 25 * 3600));
    await service.retryPending();
    expect(queue.has(oldMarker)).toBe(false);
    expect(prisma.appSetting.findMany).toHaveBeenCalledWith({ where: { key: { startsWith: 'radius_disconnect_' } }, take: 100, orderBy: [{ updatedAt: 'asc' }, { key: 'asc' }] });
  });

  it('uses unique NAS source identity even when another router has that IP as its Disconnect destination', async () => {
    const { service, prisma, radius } = setup();
    prisma.nas.findMany.mockResolvedValue([{ ...router, id: 9, nasname: '10.1.2.3', ipAddress: router.nasname, secret: 'other-nas-secret' }, router]);
    prisma.radacct.findMany.mockResolvedValue([session()]);
    await service.disconnect('andi', 3);
    expect(radius.disconnect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ host: router.ipAddress, secret: router.secret, nasAddress: router.nasname }));
    expect((await service.accountPresence([{ username: 'andi', routerNasId: 9 }])).states.get('andi')).toBe(false);
  });

  it('cancels an old exact retry when accounting proves the NAS reused its session ID for a newer connection', async () => {
    const { service, prisma, radius, pending } = setup();
    prisma.radacct.findMany.mockResolvedValue([session()]);
    radius.disconnect.mockRejectedValueOnce(new Error('timeout'));
    await service.disconnect('andi', 3);
    vi.setSystemTime(new Date(now.getTime() + 60000));
    prisma.radacct.findMany.mockResolvedValue([{ ...session(), acctstarttime: new Date(now.getTime() + 30000) }]);
    await service.retryPending();
    expect(radius.disconnect).toHaveBeenCalledTimes(1); expect(pending()).toHaveLength(0);
  });

  it('still retries a captured deleted-account session if its accounting history no longer exists', async () => {
    const { service, prisma, radius, pending } = setup();
    radius.disconnect.mockRejectedValueOnce(new Error('timeout'));
    await service.disconnect('andi', null, [session()]);
    vi.setSystemTime(new Date(now.getTime() + 60000));
    prisma.radacct.findMany.mockResolvedValue([]);
    await service.retryPending();
    expect(radius.disconnect).toHaveBeenCalledTimes(2); expect(pending()).toHaveLength(0);
  });

  it('quarantines malformed outbox entries without logging their payload or blocking later valid jobs', async () => {
    const { service, prisma, radius, queue, pending } = setup();
    queue.set('radius_disconnect_broken', '{invalid-json');
    queue.set('radius_disconnect_bad-target', JSON.stringify({ username: 'andi', routerId: 'not-an-id', secret: 'do-not-log' }));
    prisma.radacct.findMany.mockResolvedValue([session()]);
    radius.disconnect.mockRejectedValueOnce(new Error('timeout'));
    await service.disconnect('andi', 3);
    const log = vi.spyOn((service as any).logger, 'warn');
    await service.retryPending();
    expect(queue.has('radius_disconnect_broken')).toBe(false); expect(queue.has('radius_disconnect_bad-target')).toBe(false);
    expect(pending()).toHaveLength(0); expect(radius.disconnect).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain('do-not-log');
  });
});
