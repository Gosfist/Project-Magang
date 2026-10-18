import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SaveRouterDto } from './routers.dto.js';
import { RoutersService } from './routers.service.js';
import { radiusSetupScript, routerOsQuote } from '../shared/radius-setup-script.js';

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
  const prisma = { nas, pppoeAccount: { count: vi.fn(async () => 0) }, $transaction: vi.fn((queries) => Promise.all(queries)) };
  return { nas, prisma, service: new RoutersService(prisma as unknown as PrismaService) };
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
    expect(result.setup.scriptRos7).toContain('verify-server-certificate=yes');
    expect(result.setup.scriptRos7).toContain('add-default-route=no');
  });

  it('redacts RADIUS secrets and legacy API credentials from the list', async () => {
    const { service } = setup();
    const result = await service.routers();
    expect(result.data[0]).toMatchObject({ id: 7, accountsCount: 12 });
    for (const key of ['username', 'password', 'port', 'authMode', 'secret', 'vpnPassword']) expect(result.data[0]).not.toHaveProperty(key);
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
      expect(script).toContain('service=ppp authentication-port=1812 accounting-port=1813');
      expect(script).toContain('src-address="10.88.0.3"');
      expect(script).toContain('/radius incoming set accept=yes port=3799');
      expect(script).toContain(`chain=input protocol=tcp connection-state=new src-address="${router.radiusServerIp}" action=drop`);
      expect(script).toContain('UNZANET-RADIUS:7:MGMT-DENY');
      expect(script).not.toContain('/interface sstp-client add');
      expect(script).toContain(`dst-address="${router.radiusServerIp}/32" gateway="radius-cloud-7"`);
      expect(script).toContain('UNZANET-RADIUS:7:RADIUS-ROUTE');
      expect(script).toContain('Tunnel terkelola belum ada');
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
    expect(script).toContain('comment="UNZANET-RADIUS:7"');
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
});
