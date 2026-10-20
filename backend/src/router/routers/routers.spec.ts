import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SaveRouterDto } from './routers.dto.js';
import { RoutersService } from './routers.service.js';
import { radiusSetupScript, routerOsQuote } from '../shared/radius-setup-script.js';
import { VpnStatusService } from '../vpn/vpn-status.service.js';
import { activeNetworkKey, networkKey } from '../shared/nas-network.js';

const router = {
  id: 7, name: 'Router cabang', nasname: '10.88.0.3', ipAddress: '10.88.0.3', shortname: 'cabang',
  secret: 'test-only-secret', ports: 1812, coaPort: 3799, radiusServerIp: '10.88.0.2',
  type: 'mikrotik', isActive: true, vpnHost: null, vpnUsername: null,
};

function setup() {
  const nas = {
    create: vi.fn(async ({ data }) => ({ ...router, ...data })),
    findUnique: vi.fn(async () => router),
    findFirst: vi.fn(async () => null),
    update: vi.fn(async ({ data }) => ({ ...router, ...data })),
    findMany: vi.fn(async () => [{ ...router, username: 'legacy-admin', password: 'legacy-password', _count: { accounts: 12 } }]),
    count: vi.fn(async () => 1), delete: vi.fn(),
  };
  const settings = new Map<string, string>();
  const pools: any[] = [];
  const prisma: any = { nas, pppoeAccount: { count: vi.fn(async () => 0) },
    appSetting: {
      findUnique: vi.fn(async ({ where }) => settings.has(where.key) ? { key: where.key, value: settings.get(where.key)! } : null),
      findMany: vi.fn(async ({ where }) => [...settings].filter(([key]) => where.key.in.includes(key)).map(([key, value]) => ({ key, value }))),
      upsert: vi.fn(async ({ where, create, update }) => { settings.set(where.key, settings.has(where.key) ? update.value : create.value); }),
    },
    ipPool: { findMany: vi.fn(async ({ where }) => pools.filter(pool => pool.routerNasId === where.routerNasId && where.name.in.includes(pool.name))), upsert: vi.fn(async ({ where, create, update }) => {
      const current = pools.find(pool => pool.routerNasId === where.routerNasId_name.routerNasId && pool.name === where.routerNasId_name.name);
      if (current) Object.assign(current, update); else pools.push({ id: BigInt(pools.length + 1), ...create });
    }) },
  };
  prisma.$transaction = vi.fn((queries: any) => typeof queries === 'function' ? queries(prisma) : Promise.all(queries));
  return { nas, prisma, settings, pools, service: new RoutersService(prisma as unknown as PrismaService) };
}

describe('Zero MikroTik API NAS registry', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('saves only RADIUS/NAS fields and returns transient SSTP script without storing the VPN password', async () => {
    const { nas, service } = setup();
    const result = await service.createRouter({
      name: router.name, nasname: router.nasname, radiusServerIp: router.radiusServerIp,
      vpnHost: 'vpn.example.test', vpnUsername: 'nas07', vpnPassword: 'one-time-vpn-password',
    });
    const data = nas.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ nasname: router.nasname, ipAddress: router.nasname, coaPort: 3799, ports: 1812 });
    expect(data.secret).toMatch(/^[a-f0-9]{48}$/);
    for (const key of ['username', 'password', 'port', 'authMode', 'vpnPassword']) expect(data).not.toHaveProperty(key);
    expect(result.router).not.toHaveProperty('secret');
    expect(result.setup.scriptRos7).toContain('password="one-time-vpn-password"');
    expect(result.setup.scriptRos7).toContain('verify-server-certificate=no');
    expect(result.setup.scriptRos7).toContain('add-default-route=no');
    expect(result.setup.script).toBe(result.setup.scriptRos7);
    expect(result.setup.script).toContain('/interface sstp-client add');
    expect(result.setup.script).toContain('/ip route add');
    expect(result.setup.script).not.toContain('set [find');
  });

  it('redacts RADIUS secrets and legacy API credentials from the list', async () => {
    const { service } = setup();
    const result = await service.routers();
    expect(result.data[0]).toMatchObject({ id: 7, accountsCount: 12 });
    for (const key of ['username', 'password', 'port', 'authMode', 'secret', 'vpnPassword']) expect(result.data[0]).not.toHaveProperty(key);
  });

  it('adds VPN session status to NAS lists using one snapshot, independently of registration', async () => {
    const { prisma, nas } = setup();
    nas.findMany.mockResolvedValueOnce([{ ...router, vpnClientId: 1n, vpnHost: '192.0.2.1', vpnUsername: 'vpn_a', isActive: true } as any]);
    const status = new VpnStatusService();
    const read = vi.spyOn(status, 'snapshot').mockResolvedValue({ checkedAt: new Date().toISOString(), available: true, sessions: [] });
    const service = new RoutersService(prisma as any, undefined, status);
    const result = await service.routers();
    expect(result.data[0]).toMatchObject({ isActive: true, vpnStatus: 'offline' });
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.data[0]).not.toHaveProperty('secret');
  });

  it('creates direct add scripts for initial installation without conditions or CA import', async () => {
    const { service } = setup();
    const result = await service.createRouter({
      name: router.name, nasname: router.nasname, radiusServerIp: router.radiusServerIp,
      vpnHost: 'vpn.example.test', vpnUsername: 'nas07', vpnPassword: 'one-time-vpn-password',
    });
    for (const script of [result.setup.scriptRos6, result.setup.scriptRos7]) {
      expect(script).toContain('authentication=mschap2');
      expect(script).not.toMatch(/\ballow=/);
      expect(script).not.toContain('/certificate');
      expect(script).not.toContain('/file');
      expect(script).not.toContain('BEGIN CERTIFICATE');
      expect(script).toContain('verify-server-certificate=no verify-server-address-from-certificate=no');
      expect(script).toContain('/radius incoming set accept=yes port=3799');
      expect(script).not.toMatch(/:if|:len|:local/);
      expect(script).toContain('/interface sstp-client add name="UNZANET-RADIUS:VPN"');
      const comments = Array.from(script.matchAll(/comment="([^"]+)"/g), match => match[1]);
      expect(comments).toHaveLength(5);
      expect(new Set(comments)).toEqual(new Set(['UNZANET-RADIUS:VPN']));
      expect(script).not.toContain('/ip firewall filter move');
      expect(script).toContain('/ip route add dst-address=');
      expect(script).toContain('/radius add address=');
      expect(script).not.toContain('/interface sstp-client set');
      expect(script).not.toContain('/radius set');
      expect(script).not.toContain('/ip route set');
      expect(script).not.toMatch(/ remove /);
      expect(script.split('\n').length).toBeLessThanOrEqual(13);
    }
  });

  it('strips the removed CA field at the HTTP boundary', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const dto = await pipe.transform({ name: router.name, nasname: router.nasname, vpnCaCertificate: 'old-client-value' }, { type: 'body', metatype: SaveRouterDto });
    expect(dto).not.toHaveProperty('vpnCaCertificate');
  });

  it('preserves existing secret on blank edit and allows clearing VPN metadata', async () => {
    const { nas, service } = setup();
    const result = await service.updateRouter('7', { name: router.name, nasname: router.nasname, secret: '', vpnHost: '', vpnUsername: '' });
    expect(nas.update.mock.calls[0][0].data).toMatchObject({ secret: router.secret, vpnHost: null, vpnUsername: null });
    expect(result.setup.scriptRos7).not.toContain('/interface sstp-client');
  });

  it('requires an explicit reachable RADIUS server IP before creating a NAS', async () => {
    vi.stubEnv('RADIUS_SERVER_IP', '');
    const { nas, service } = setup();
    await expect(service.createRouter({ name: router.name, nasname: router.nasname })).rejects.toThrow('IP server RADIUS');
    expect(nas.create).not.toHaveBeenCalled();
  });

  it('can use configured server IP and rejects duplicate source NAS addresses', async () => {
    vi.stubEnv('RADIUS_SERVER_IP', '10.88.0.2');
    const { nas, service } = setup();
    nas.findFirst.mockResolvedValueOnce({ id: 4 } as any);
    await expect(service.createRouter({ name: router.name, nasname: router.nasname })).rejects.toThrow('IP sumber NAS');
    expect(nas.create).not.toHaveBeenCalled();
  });

  it('regenerates RADIUS scripts without recreating a tunnel whose password was never stored', async () => {
    const { nas, service } = setup();
    nas.findUnique.mockResolvedValueOnce({ ...router, vpnHost: 'vpn.example.test', vpnUsername: 'nas07' } as any);
    const result = await service.getRouterScript('7');
    expect(result).toMatchObject({ radiusServerIp: router.radiusServerIp, nasSrcAddress: router.nasname, authPort: 1812, coaPort: 3799 });
    for (const script of [result.scriptRos6, result.scriptRos7]) {
      expect(script).toContain('/system clock set time-zone-autodetect=no time-zone-name=Asia/Jakarta;');
      expect(script).toContain('service=ppp authentication-port=1812 accounting-port=1813');
      expect(script).toContain('src-address="10.88.0.3"');
      expect(script).toContain('/radius incoming set accept=yes port=3799');
      expect(script).toContain(`chain=input protocol=tcp connection-state=new src-address="${router.radiusServerIp}" action=drop`);
      expect(script).not.toContain('/ip firewall filter move');
      expect(script).not.toContain('/interface sstp-client add');
      expect(script).toContain(`dst-address="${router.radiusServerIp}/32" gateway="UNZANET-RADIUS:VPN" comment="UNZANET-RADIUS:VPN"`);
      expect(script).toContain('Gunakan tunnel yang sudah ada');
      expect(script).not.toContain('dst-address="0.0.0.0/0"');
      expect(script).not.toContain('/ip hotspot profile');
      expect(script).not.toContain('service=ppp,hotspot,login');
      expect(script).not.toContain('require-message-auth=no');
    }
  });

  it('escapes RouterOS interpolation, quotes, control bytes and non ASCII in secrets', () => {
    expect(routerOsQuote('a"$\\\n\u00e9')).toBe('"a\\"\\$\\\\\\0A\\C3\\A9"');
    const script = radiusSetupScript({ ...router, secret: '$[/user remove [find]]"' } as any, router.radiusServerIp, router.nasname, true);
    expect(script).toContain('secret="\\$[/user remove [find]]\\""');
    expect(script).toContain('comment="UNZANET-RADIUS:VPN"');
  });

  it('does not delete a NAS with linked subscribers', async () => {
    const { prisma, nas, service } = setup();
    prisma.pppoeAccount.count.mockResolvedValueOnce(12);
    await expect(service.removeRouter('7')).rejects.toThrow('12 pelanggan');
    expect(nas.delete).not.toHaveBeenCalled();
  });

  it('strips removed router API fields using the real HTTP validation options', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const result = await pipe.transform({ name: 'Router', nasname: '10.88.0.3', username: 'admin', password: 'test-only', port: 8728 }, { type: 'body', metatype: SaveRouterDto });
    expect(result).toMatchObject({ name: 'Router', nasname: '10.88.0.3' });
    for (const key of ['username', 'password', 'port']) expect(result).not.toHaveProperty(key);
  });

  it('saves and activates prefixes atomically without installation confirmation, always returning add', async () => {
    const { service, pools, settings, prisma } = setup();
    const result = await service.createRouter({ name: router.name, nasname: router.nasname, radiusServerIp: router.radiusServerIp, internetCidr: '192.168.75.1/24', isolationCidr: '192.168.100.1/24' });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(pools).toEqual(expect.arrayContaining([expect.objectContaining({ routerNasId: 7, name: 'Internet', networkStart: '192.168.75.2', networkEnd: '192.168.75.254' })]));
    expect(settings.has(activeNetworkKey(7))).toBe(true);
    expect(settings.has('pppoe_isolation_router_7')).toBe(true);
    expect(result.setup).not.toHaveProperty('networkNeedsConfirmation');
    expect(result.setup).not.toHaveProperty('scriptUpdate');
    expect(result.setup.scriptRos7).toContain('/ip pool add name="Internet"');
    const reopened = await service.getRouterScript('7');
    for (const command of ['/radius add', '/ip pool add name="Internet"', '/ip pool add name="pool-isolir"', '/ppp profile add', '/ip firewall filter add']) {
      expect(reopened.script).toContain(command);
    }
    expect(reopened.script).not.toContain('set [find');
    expect(reopened.script.indexOf('/ip pool add name="Internet"')).toBeLessThan(reopened.script.indexOf('name="UNZANET-INTERNET-7"'));
    expect(reopened.script.indexOf('/ip pool add name="pool-isolir"')).toBeLessThan(reopened.script.indexOf('name="UNZANET-ISOLIR-7"'));
    expect(JSON.parse(settings.get('pppoe_isolation_router_7')!)).toMatchObject({ enabled: true, poolName: 'pool-isolir', subnet: '192.168.100.0/24', localAddress: '192.168.100.1', syncPending: true });
    const updated = await service.updateRouter('7', { name: router.name, nasname: router.nasname, internetCidr: '192.168.76.1/24', isolationCidr: '192.168.100.1/24' });
    expect(updated.setup.script).toContain('/radius add');
    expect(updated.setup.script).not.toContain('set [find');
    expect(updated.setup.script).toContain('/ip pool add name="Internet" ranges="192.168.76.2-192.168.76.254"');
    expect(JSON.parse(settings.get(activeNetworkKey(7))!).internet.cidr).toBe('192.168.76.1/24');
    expect(JSON.parse(settings.get(networkKey(7))!).internet.cidr).toBe('192.168.76.1/24');
    const config = JSON.parse(settings.get('pppoe_isolation_router_7')!); config.syncPending = false;
    settings.set('pppoe_isolation_router_7', JSON.stringify(config));
    await service.updateRouter('7', { name: router.name, nasname: router.nasname, internetCidr: '192.168.76.1/24', isolationCidr: '192.168.100.1/24' });
    expect(JSON.parse(settings.get('pppoe_isolation_router_7')!).syncPending).toBe(false);
    expect(JSON.parse(settings.get(activeNetworkKey(7))!).internet.cidr).toBe('192.168.76.1/24');
  });

  it('validates both prefixes and VPN overlap before writing the NAS', async () => {
    const { service, nas } = setup();
    const base = { name: router.name, nasname: router.nasname, radiusServerIp: router.radiusServerIp };
    await expect(service.createRouter({ ...base, internetCidr: '192.168.75.1/24' })).rejects.toThrow('IP Pool Isolir');
    await expect(service.createRouter({ ...base, internetCidr: '10.88.0.1/24', isolationCidr: '192.168.100.1/24' })).rejects.toThrow('IP NAS');
    expect(nas.create).not.toHaveBeenCalled();
  });
  it('does not infer router installation from database pool records or editing a NAS', async () => {
    const { service, pools } = setup();
    pools.push({ id: 9n, routerNasId: 7, name: 'Internet', networkStart: '192.168.75.1', networkEnd: '192.168.75.254' });
    const result = await service.updateRouter('7', { name: router.name, nasname: router.nasname, internetCidr: '192.168.75.1/24', isolationCidr: '192.168.100.1/24' });
    expect(result.setup.script).toContain('/ip pool add name="Internet"');
    expect(result.setup.script).not.toContain('set [find');
    expect(result.setup.script).toContain('/ppp profile add copy-from=default name="UNZANET-INTERNET-7"');
    expect(pools.filter(pool => pool.name === 'Internet')).toHaveLength(1);
    const reopened = await service.getRouterScript('7');
    expect(reopened.script).toBe(result.setup.script);
  });
});
