import { describe, expect, it, vi } from 'vitest';
import { IsolationService } from './isolation.service.js';
import { RadiusService } from '../shared/radius.service.js';

function setup() {
  const settings = new Map<string, string>();
  const rules: Record<string, string>[] = [{ '.id': '*1', chain: 'forward', action: 'fasttrack-connection' }, { '.id': '*2', chain: 'forward', action: 'accept' }];
  const profiles: Record<string, string>[] = [];
  const pools: Record<string, string>[] = [{ name: 'internet', ranges: '192.168.75.2-192.168.75.254' }, { name: 'pool-isolir', ranges: '192.168.100.2-192.168.100.254' }];
  const addresses: Record<string, string>[] = [{ address: '10.0.0.1/24' }];
  const sessions: Record<string, string>[] = [{ '.id': '*10', name: 'isolated', address: '192.168.75.2', service: 'pppoe' }, { '.id': '*11', name: 'normal', address: '192.168.75.3', service: 'pppoe' }];
  const accounts = [false, true].map((isActive, i) => ({ id: BigInt(i + 1), routerNasId: 3, username: i ? 'normal' : 'isolated', isActive, expiresAt: null as Date | null, password: 'encrypted', paymentPromises: [], package: { isActive: true, addressPool: 'internet', uploadMbps: 5, downloadMbps: 5 } }));
  let sequence = 20;
  const parse = (words: string[]) => Object.fromEntries(words.filter(word => word.startsWith('=')).map(word => { const at = word.indexOf('=', 1); return [word.slice(1, at), word.slice(at + 1)]; }));
  const write = vi.fn(async (path: string, words: string[] = []) => {
    const fields = parse(words);
    if (path === '/ip/pool/print') return pools.map(row => ({ ...row }));
    if (path === '/ip/address/print') return addresses;
    if (path === '/ppp/profile/print') return profiles.map(row => ({ ...row }));
    if (path === '/ppp/profile/add') { profiles.push({ '.id': '*F', ...fields }); return []; }
    if (path === '/ppp/profile/set') { Object.assign(profiles[0], fields); return []; }
    if (path === '/ip/firewall/filter/print') return rules.map(row => ({ ...row }));
    if (path === '/ip/firewall/filter/add') { rules.push({ '.id': '*' + (sequence++).toString(16), ...fields, disabled: 'false' }); return []; }
    if (path === '/ip/firewall/filter/move') { const index = rules.findIndex(row => row['.id'] === fields['.id']); const [item] = rules.splice(index, 1); const dest = rules.findIndex(row => row['.id'] === fields['destination']); rules.splice(dest < 0 ? rules.length : dest, 0, item); return []; }
    if (path === '/ip/firewall/filter/remove') { rules.splice(rules.findIndex(row => row['.id'] === fields['.id']), 1); return []; }
    if (path === '/ppp/active/print') return sessions.map(row => ({ ...row }));
    if (path === '/ppp/active/remove') { sessions.splice(sessions.findIndex(row => row['.id'] === fields['.id']), 1); return []; }
    throw new Error('unexpected command ' + path);
  });
  const checks: any[] = [], replies: any[] = [];
  const appSetting = { findUnique: vi.fn(async ({ where }) => settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null),
    findMany: vi.fn(async () => [...settings].map(([key, value]) => ({ key, value }))),
    upsert: vi.fn(async ({ where, create, update }) => { settings.set(where.key, settings.has(where.key) ? update.value : create.value); }),
    update: vi.fn(async ({ where, data }) => { settings.set(where.key, data.value); }),
  };
  const prisma = { appSetting, nas: { findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true }) }, pppoePackage: { count: vi.fn().mockResolvedValue(0) },
    pppoeAccount: { findMany: vi.fn(async ({ where }) => accounts.filter(row => row.id > where.id.gt)), findUnique: vi.fn(async ({ where }) => accounts.find(row => row.id === where.id)) },
    paymentPromise: { findFirst: vi.fn().mockResolvedValue(null) },
    radcheck: { findMany: vi.fn(async () => checks), deleteMany: vi.fn(async ({ where }) => { for (let i = checks.length - 1; i >= 0; i--) if (where.username.in.includes(checks[i].username)) checks.splice(i, 1); }), createMany: vi.fn(async ({ data }) => { checks.push(...data); }) },
    radreply: { findMany: vi.fn(async () => replies), deleteMany: vi.fn(async ({ where }) => { for (let i = replies.length - 1; i >= 0; i--) if (where.username.in.includes(replies[i].username)) replies.splice(i, 1); }), createMany: vi.fn(async ({ data }) => { replies.push(...data); }) },
    $transaction: vi.fn(async (action) => action(prisma)),
  };
  const mikrotik = { withRouter: vi.fn(async (_, action) => action(write)), errorMessage: () => 'API gagal' };
  const service = new IsolationService(prisma as any, mikrotik as any, new RadiusService({ decrypt: () => 'test-password' } as any));
  const dto = { enabled: true, poolName: 'pool-isolir', subnet: '192.168.100.0/24', localAddress: '192.168.100.1' };
  return { service, dto, prisma, settings, rules, profiles, pools, sessions, accounts, addresses, write, mikrotik, checks, replies };
}

describe('router isolation provisioning and synchronization', () => {
  it('installs three drops above FastTrack and syncs credentials without reconnecting normal clients', async () => {
    const { service, dto, rules, profiles, replies, sessions, write } = setup();
    await service.save(3, dto);
    await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed'));
    expect(rules.slice(0, 3).map(row => row.action)).toEqual(['drop', 'drop', 'drop']);
    expect(rules[3].action).toBe('fasttrack-connection');
    expect(profiles[0]).toMatchObject({ 'use-ipv6': 'no', 'local-address': '192.168.100.1', 'remote-address': 'pool-isolir' });
    expect(replies).toContainEqual(expect.objectContaining({ username: 'isolated', attribute: 'Framed-Pool', value: 'pool-isolir' }));
    expect(sessions.map(row => row.name)).toEqual(['normal']);
    expect(write).toHaveBeenCalledWith('/ppp/active/remove', ['=.id=*10']);
    expect((await service.get(3)).ready).toBe(true);
    await service.save(3, dto);
    await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed'));
    expect(rules.filter(row => row.comment?.startsWith('UNZANET-ISOLIR:'))).toHaveLength(3);
    expect(profiles).toHaveLength(1);
  });
  it.each(['overlap', 'next-pool', 'gateway'])('rejects unsafe %s pools before enabling mode', async reason => {
    const { service, dto, pools, settings, profiles } = setup();
    if (reason === 'overlap') pools[0].ranges = '192.168.100.10-192.168.100.20';
    if (reason === 'next-pool') pools[1]['next-pool'] = 'internet';
    if (reason === 'gateway') pools[1].ranges = '192.168.100.1-192.168.100.254';
    await expect(service.save(3, dto)).rejects.toThrow();
    expect(settings.size).toBe(0); expect(profiles).toHaveLength(0);
  });
  it('keeps mode unconfigured when the router is unreachable', async () => {
    const { service, dto, mikrotik, settings } = setup();
    mikrotik.withRouter.mockRejectedValue(new Error('offline'));
    await expect(service.save(3, dto)).rejects.toThrow('API gagal');
    expect(settings.size).toBe(0);
  });
  it('moves expired sessions once and leaves already correct isolated sessions connected', async () => {
    const { service, dto, accounts, sessions, write } = setup();
    await service.save(3, dto); await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed'));
    sessions.push({ '.id': '*12', name: 'isolated', address: '192.168.100.2', service: 'pppoe' });
    accounts[1].expiresAt = new Date(Date.now() - 2 * 86400000);
    write.mockClear();
    await service.refreshExpired();
    expect(write).toHaveBeenCalledWith('/ppp/active/remove', ['=.id=*11']);
    expect(sessions.map(row => row.name)).toEqual(['isolated']);
    write.mockClear(); await service.refreshExpired();
    expect(write.mock.calls.some(([path]) => path === '/ppp/active/remove')).toBe(false);
  });
  it('can reapply while isolated PPP sessions expose a dynamic gateway /32', async () => {
    const { service, dto, addresses, profiles } = setup();
    await service.save(3, dto); await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed'));
    addresses.push({ address: '192.168.100.1/32', dynamic: 'true' });
    await service.save(3, dto); await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed'));
    profiles[0]['remote-address'] = 'internet';
    expect((await service.get(3)).ready).toBe(false);
  });
  it('disables by restoring legacy rejection before disconnecting and removing drop rules', async () => {
    const { service, dto, sessions, rules, checks, settings } = setup();
    await service.save(3, dto); await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed'));
    sessions.push({ '.id': '*12', name: 'isolated', address: '192.168.100.2', service: 'pppoe' });
    await service.save(3, { ...dto, enabled: false }); await vi.waitFor(() => expect(service.status(3).job?.status).toBe('completed'));
    expect(checks.some(row => row.username === 'isolated')).toBe(false);
    expect(checks.some(row => row.username === 'normal')).toBe(true);
    expect(sessions.map(row => row.name)).toEqual(['normal']);
    expect(rules.some(row => row.comment?.startsWith('UNZANET-ISOLIR:'))).toBe(false);
    expect(JSON.parse(settings.get('pppoe_isolation_router_3')!).syncPending).toBe(false);
  });
});
