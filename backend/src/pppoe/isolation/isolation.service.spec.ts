import { describe, expect, it, vi } from 'vitest';
import { IsolationService } from './isolation.service.js';
import { RadiusService } from '../shared/radius.service.js';
import { activeNetworkKey, nasNetwork } from '../../router/shared/nas-network.js';

function setup() {
  const settings = new Map<string, string>();
  const pools = [{ id: 1n, routerNasId: 3, name: 'internet', networkStart: '192.168.75.2', networkEnd: '192.168.75.254' }, { id: 2n, routerNasId: 3, name: 'pool-isolir', networkStart: '192.168.100.2', networkEnd: '192.168.100.254' }];
  const sessions = [{ username: 'isolated', nasipaddress: '10.99.0.2', acctsessionid: 'old-session', framedipaddress: '192.168.75.2' }, { username: 'normal', nasipaddress: '10.99.0.2', acctsessionid: 'normal-session', framedipaddress: '192.168.75.3' }];
  const accounts = [false, true].map((isActive, i) => ({ id: BigInt(i + 1), routerNasId: 3, username: i ? 'normal' : 'isolated', isActive, expiresAt: null as Date | null, password: 'encrypted', paymentPromises: [], package: { isActive: true, addressPool: 'internet', uploadMbps: 5, downloadMbps: 5 } }));
  const checks: any[] = [], replies: any[] = [];
  const appSetting = {
    findUnique: vi.fn(async ({ where }) => settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null),
    findMany: vi.fn(async () => [...settings].map(([key, value]) => ({ key, value }))),
    upsert: vi.fn(async ({ where, create, update }) => { settings.set(where.key, settings.has(where.key) ? update.value : create.value); }),
    update: vi.fn(async ({ where, data }) => { settings.set(where.key, data.value); }),
  };
  const prisma = { appSetting,
    nas: { findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true, nasname: '10.99.0.2', ipAddress: '10.99.0.2' }) },
    ipPool: { findMany: vi.fn().mockResolvedValue(pools) }, pppoePackage: { count: vi.fn().mockResolvedValue(0) },
    pppoeAccount: { findMany: vi.fn(async ({ where }) => accounts.filter(row => row.id > where.id.gt)), findUnique: vi.fn(async ({ where }) => accounts.find(row => row.id === where.id)) },
    paymentPromise: { findFirst: vi.fn().mockResolvedValue(null) }, radacct: { findMany: vi.fn().mockResolvedValue(sessions) },
    radcheck: { findMany: vi.fn(async () => checks), deleteMany: vi.fn(async ({ where }) => { for (let i = checks.length - 1; i >= 0; i--) if (where.username.in.includes(checks[i].username)) checks.splice(i, 1); }), createMany: vi.fn(async ({ data }) => { checks.push(...data); }) },
    radreply: { findMany: vi.fn(async () => replies), deleteMany: vi.fn(async ({ where }) => { for (let i = replies.length - 1; i >= 0; i--) if (where.username.in.includes(replies[i].username)) replies.splice(i, 1); }), createMany: vi.fn(async ({ data }) => { replies.push(...data); }) },
    $transaction: vi.fn(async (action: any) => action(prisma)),
  };
  const network = { disconnect: vi.fn().mockResolvedValue({ completed: 1, warnings: [] }) };
  const service = new IsolationService(prisma as any, network as any, new RadiusService({ decrypt: () => 'test-password' } as any));
  const dto = { enabled: true, poolName: 'pool-isolir', subnet: '192.168.100.0/24', localAddress: '192.168.100.1' };
  const enable = async () => { const draft = await service.save(3, dto); const result = await service.save(3, { ...dto, scriptInstalled: true, scriptFingerprint: draft.scriptFingerprint }); await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed')); return result; };
  return { service, dto, prisma, settings, pools, sessions, accounts, network, checks, replies, enable };
}

describe('RADIUS isolation with manually installed router scripts', () => {
  it('generates a script without enabling access or touching sessions before installation confirmation', async () => {
    const { service, dto, settings, prisma, network } = setup();
    const result = await service.save(3, dto);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.script).toContain('use-ipv6=no');
    expect(result.script).toContain('UNZANET-ISOLIR:3:OUT');
    expect(result.script).toContain('UNZANET-ISOLIR:3:IN');
    expect(result.script).toContain('UNZANET-ISOLIR:3:ROUTER');
    expect(result.script).toContain(':if ([:len $item] = 0) do={ /ip pool add');
    expect(settings.size).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(network.disconnect).not.toHaveBeenCalled();
  });
  it('syncs valid credentials then disconnects only mismatched accounting sessions after confirmation', async () => {
    const { enable, replies, checks, network, sessions } = setup();
    await enable();
    expect(replies).toContainEqual(expect.objectContaining({ username: 'isolated', attribute: 'Framed-Pool', value: 'pool-isolir' }));
    expect(checks).toContainEqual(expect.objectContaining({ username: 'isolated', attribute: 'Cleartext-Password' }));
    expect(checks.some(row => row.attribute === 'Expiration')).toBe(false);
    expect(network.disconnect).toHaveBeenCalledExactlyOnceWith('isolated', null, [sessions[0]]);
  });
  it('reports manual verification rather than inventing live router readiness', async () => {
    const { service, enable } = setup(); await enable();
    const result = await service.get(3);
    expect(result.ready).toBe(false); expect(result.verification).toBe('manual');
    expect(result.rules).toEqual([]);
    expect(result.pools).toContainEqual({ name: 'pool-isolir', ranges: '192.168.100.2-192.168.100.254' });
  });
  it('leaves already isolated sessions connected and handles an expiry on the next refresh', async () => {
    const { service, enable, sessions, accounts, network } = setup(); await enable();
    sessions[0].framedipaddress = '192.168.100.2';
    network.disconnect.mockClear();
    await service.refreshExpired(); expect(network.disconnect).not.toHaveBeenCalled();
    accounts[1].expiresAt = new Date('2020-01-01');
    await service.refreshExpired();
    expect(network.disconnect).toHaveBeenCalledExactlyOnceWith('normal', null, [sessions[1]]);
    sessions[1].framedipaddress = '192.168.100.3'; network.disconnect.mockClear();
    await service.refreshExpired(); expect(network.disconnect).not.toHaveBeenCalled();
  });
  it('rejects a gateway in the pool and overlap with another registered pool without enabling', async () => {
    const { service, dto, pools, settings } = setup();
    await expect(service.save(3, { ...dto, localAddress: '192.168.100.2' })).rejects.toThrow('gateway');
    pools[0].networkStart = '192.168.100.10'; pools[0].networkEnd = '192.168.100.11';
    await expect(service.save(3, dto)).rejects.toThrow('tumpang tindih');
    expect(settings.size).toBe(0);
  });
  it('requires a registered isolation pool on this NAS and prohibits package pools', async () => {
    const { service, dto, pools, prisma } = setup();
    pools.pop(); await expect(service.save(3, dto)).rejects.toThrow('NAS yang sama');
    prisma.pppoePackage.count.mockResolvedValue(1);
    await expect(service.save(3, dto)).rejects.toThrow('pool internet');
  });
  it('keeps a pending sync and actionable message when Disconnect is not acknowledged', async () => {
    const { service, dto, settings, network } = setup();
    network.disconnect.mockResolvedValue({ completed: 0, warnings: ['Disconnect timeout; permintaan disimpan'] });
    const draft = await service.save(3, dto);
    await service.save(3, { ...dto, scriptInstalled: true, scriptFingerprint: draft.scriptFingerprint });
    await vi.waitFor(() => expect(service.status(3).job?.status).toBe('failed'));
    expect(JSON.parse(settings.get('pppoe_isolation_router_3')!).syncPending).toBe(true);
    expect(service.status(3).job?.message).toContain('timeout');
  });
  it('disables in RADIUS and disconnects remaining isolated sessions while retaining drop rules', async () => {
    const { enable, service, dto, checks, network, sessions, settings } = setup(); await enable();
    sessions[0].framedipaddress = '192.168.100.2'; network.disconnect.mockClear();
    const result = await service.save(3, { ...dto, enabled: false });
    await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed'));
    expect(checks.some(row => row.username === 'isolated')).toBe(false);
    expect(checks.some(row => row.username === 'normal')).toBe(true);
    expect(network.disconnect).toHaveBeenCalledExactlyOnceWith('isolated', null, [sessions[0]]);
    expect(result.script).not.toContain('/ip firewall filter remove');
    expect(JSON.parse(settings.get('pppoe_isolation_router_3')!).syncPending).toBe(false);
  });
  it('does not process an account moved to another NAS during the transaction', async () => {
    const { enable, prisma, network } = setup();
    prisma.pppoeAccount.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, routerNasId: 4 }) as any);
    await enable(); expect(network.disconnect).not.toHaveBeenCalled();
  });
  it('rejects a stale script confirmation after registered pool ranges change', async () => {
    const { service, dto, pools, settings, network } = setup();
    const draft = await service.save(3, dto);
    pools[1].networkEnd = '192.168.100.250';
    await expect(service.save(3, { ...dto, scriptInstalled: true, scriptFingerprint: draft.scriptFingerprint })).rejects.toThrow('data pool berubah');
    expect(settings.size).toBe(0); expect(network.disconnect).not.toHaveBeenCalled();
  });
  it('reconnects normal and isolated sessions when NAS prefixes are confirmed, then avoids repeating matching sessions', async () => {
    const { settings, enable, network, replies, sessions, service } = setup();
    settings.set(activeNetworkKey(3), JSON.stringify(nasNetwork(3, '192.168.76.1/24', '192.168.100.1/24')));
    await enable();
    expect(network.disconnect).toHaveBeenCalledWith('normal', null, [sessions[1]]);
    expect(replies).toContainEqual(expect.objectContaining({ username: 'normal', attribute: 'Mikrotik-Group', value: 'UNZANET-INTERNET-3' }));
    sessions[0].framedipaddress = '192.168.100.2'; sessions[1].framedipaddress = '192.168.76.2';
    network.disconnect.mockClear();
    await service.refreshExpired();
    expect(network.disconnect).not.toHaveBeenCalled();
  });
});
