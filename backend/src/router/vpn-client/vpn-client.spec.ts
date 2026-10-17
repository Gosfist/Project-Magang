import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, UnauthorizedException, type ExecutionContext, type INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { VpnClientService } from './vpn-client.service.js';
import { VpnClientController } from './vpn-client.controller.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RoutersService } from '../routers/routers.service.js';
import { radiusSetupScript } from '../shared/radius-setup-script.js';

function setup() {
  const rows = new Map<bigint, any>();
  const nasRows = new Map<number, any>();
  let nextId = 1n;
  function matches(row: any, where: any = {}): boolean {
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (key === 'OR') return value.some((item: any) => matches(row, item));
      if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not;
      if (value && typeof value === 'object' && 'contains' in value) return row[key]?.includes(value.contains);
      return row[key] === value;
    });
  }
  function select(row: any, fields: any) {
    if (!row) return null;
    return fields ? Object.fromEntries(Object.keys(fields).map(key => [key,
      key === 'routers' ? [...nasRows.values()].filter(nas => nas.vpnClientId === row.id).map(nas => ({ id: nas.id, name: nas.name })) : row[key],
    ])) : row;
  }
  const vpnClient = {
    findMany: vi.fn(async (args: any) => {
      const items = [...rows.values()].filter(row => matches(row, args?.where));
      if (args?.orderBy?.id) items.sort((a, b) => Number(b.id - a.id));
      return items.slice(args?.skip || 0, args?.take ? (args.skip || 0) + args.take : undefined).map(row => select(row, args?.select));
    }),
    findFirst: vi.fn(async (args: any) => select([...rows.values()].find(row => matches(row, args.where)), args.select)),
    findUnique: vi.fn(async (args: any) => select(rows.get(args.where.id), args.select)),
    count: vi.fn(async (args: any) => [...rows.values()].filter(row => matches(row, args?.where)).length),
    create: vi.fn(async (args: any) => { const row = { id: nextId++, ...args.data }; rows.set(row.id, row); return select(row, args.select); }),
    update: vi.fn(async (args: any) => { const row = { ...rows.get(args.where.id), ...args.data }; rows.set(row.id, row); return select(row, args.select); }),
    delete: vi.fn(async (args: any) => rows.delete(args.where.id)),
  };
  const nas = {
    findUnique: vi.fn(async (args: any) => {
      const row = nasRows.get(args.where.id);
      return row && args.include?.vpnClient ? { ...row, vpnClient: rows.get(row.vpnClientId) } : row;
    }),
    count: vi.fn(async (args: any) => [...nasRows.values()].filter(nas => {
      const client = rows.get(nas.vpnClientId);
      return client && matches(client, args.where.vpnClient);
    }).length),
    create: vi.fn(async (args: any) => { const row = { id: nasRows.size + 1, ...args.data }; nasRows.set(row.id, row); return row; }),
    update: vi.fn(async (args: any) => { const row = { ...nasRows.get(args.where.id), ...args.data }; nasRows.set(row.id, row); return row; }),
  };
  const prisma: any = { vpnClient, nas, appSetting: { findUnique: vi.fn(() => { throw new Error('Old VPN settings must not be read'); }) } };
  prisma.$transaction = vi.fn(async (action: any) => Array.isArray(action) ? Promise.all(action) : action(prisma));
  const write = vi.fn(async (command: string, _params?: string[]) => {
    if (command === '/system/identity/print') return [{ name: 'hEX cabang' }];
    if (command === '/interface/wireguard/print') return [{ name: 'wg-provider', disabled: 'false' }];
    if (command === '/ip/address/print') return [{ interface: 'wg-provider', address: '10.66.0.44/32', disabled: 'false' }];
    throw new Error('Unexpected command');
  });
  const mikrotik = { withRouter: vi.fn(async (_router: any, action: any) => action(write)), errorMessage: () => 'Koneksi gagal.' };
  const service = new VpnClientService(prisma, mikrotik as any);
  const routers = new RoutersService(prisma, mikrotik as any);
  const dto = { deviceType: 'mikrotik' as const, vpnIp: '10.66.0.44', isActive: true };
  const addServer = () => service.createVpnClient({ deviceType: 'radius', vpnIp: '10.99.25.7' });
  return { service, routers, prisma, rows, nasRows, dto, write, mikrotik, addServer };
}

describe('External WireGuard IP registry', () => {
  it('accepts provider-assigned IPs without endpoint/key/subnet settings and derives device names', async () => {
    const { service, dto, addServer, prisma } = setup();
    const server = await addServer();
    const client = await service.createVpnClient(dto);
    expect(server.client).toMatchObject({ name: 'Server RADIUS 10.99.25.7', deviceType: 'radius', vpnType: 'wireguard', vpnIp: '10.99.25.7', isActive: true });
    expect(client.client).toMatchObject({ name: 'MikroTik 10.66.0.44', deviceType: 'mikrotik', vpnIp: dto.vpnIp });
    expect(prisma.appSetting.findUnique).not.toHaveBeenCalled();
    expect(prisma.vpnClient.create.mock.calls.every(([args]) => !('clientPrivateKey' in args.data) && !('clientPublicKey' in args.data))).toBe(true);
    // Assigned .1 and addresses from other networks are valid; no global /24 restriction.
    await expect(service.createVpnClient({ ...dto, vpnIp: '100.70.80.1' })).resolves.toHaveProperty('client');
  });

  it('rejects non-unicast, invalid and CIDR addresses', async () => {
    const { service, dto } = setup();
    for (const vpnIp of ['0.0.0.0', '127.0.0.1', '224.0.0.1', '255.255.255.255', 'bad', '10.0.0.2/32']) {
      await expect(service.createVpnClient({ ...dto, vpnIp })).rejects.toThrow('IPv4');
    }
  });

  it('permits only one RADIUS record and unique IPs across roles, including inactive records', async () => {
    const { service, dto, addServer } = setup();
    await addServer();
    await expect(service.createVpnClient({ deviceType: 'radius', vpnIp: '10.99.25.8', isActive: false })).rejects.toThrow('Server RADIUS sudah terdaftar');
    await expect(service.createVpnClient({ ...dto, vpnIp: '10.99.25.7' })).rejects.toThrow('sudah digunakan');
    await service.createVpnClient({ ...dto, isActive: false });
    await expect(service.createVpnClient(dto)).rejects.toThrow('sudah digunakan');
  });

  it('supports more than ten devices, paginates and searches without including legacy secrets', async () => {
    const { service, dto, rows, addServer } = setup();
    rows.set(100n, { id: 100n, vpnType: 'openvpn', name: 'Old', vpnIp: '10.250.0.2', isRadiusServer: false, clientPrivateKey: 'NEVER-RETURN' });
    await addServer();
    for (let ip = 2; ip <= 13; ip++) await service.createVpnClient({ ...dto, vpnIp: `10.66.0.${ip}`, isActive: false });
    const page1 = await service.vpnClients();
    expect(page1.meta.total).toBe(13);
    expect(page1.data).toHaveLength(10);
    expect(page1.legacyCount).toBe(1);
    expect((await service.vpnClients('', 2)).data).toHaveLength(3);
    const search = await service.vpnClients('10.66.0.2');
    expect(search.data.map(row => row.vpnIp)).toEqual(['10.66.0.2']);
    expect(JSON.stringify(page1)).not.toContain('NEVER-RETURN');
    expect(JSON.stringify(page1)).not.toContain('clientPrivateKey');
    expect((await service.vpnClientOptions()).data).toEqual([]); // RADIUS is never an NAS option.
    await service.updateVpnClient('2', { ...dto, vpnIp: '10.66.0.2' });
    expect((await service.vpnClientOptions()).data).toEqual([{ id: '2', name: 'MikroTik 10.66.0.2', vpnIp: '10.66.0.2' }]);
    await expect(service.updateVpnClient('100', dto)).rejects.toThrow('tidak ditemukan');
  });

  it('retries serializable conflicts for concurrent uniqueness checks', async () => {
    const { service, prisma, dto } = setup();
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('retry', { code: 'P2034', clientVersion: 'test' }));
    await service.createVpnClient(dto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction.mock.calls[1][1].isolationLevel).toBe('Serializable');
  });

  it('requires an active RADIUS IP before linking NAS and only permits MikroTik clients', async () => {
    const { service, routers, dto, addServer, rows } = setup();
    await service.createVpnClient(dto);
    await expect(routers.createRouter({ name: 'NAS', nasname: dto.vpnIp, vpnClientId: '1' })).rejects.toThrow('Server RADIUS');
    await addServer();
    await expect(routers.createRouter({ name: 'NAS', nasname: dto.vpnIp, vpnClientId: '2' })).rejects.toThrow('MikroTik');
    rows.get(2n).isActive = false;
    await expect(routers.createRouter({ name: 'NAS', nasname: dto.vpnIp, vpnClientId: '1' })).rejects.toThrow('Server RADIUS');
  });

  it('sets NAS/API to the chosen router IP and RADIUS target to the separately registered server IP', async () => {
    const { service, routers, dto, addServer, rows } = setup();
    await addServer(); await service.createVpnClient(dto);
    await routers.createRouter({ name: 'NAS', nasname: '192.168.1.1', ipAddress: '192.168.1.1', vpnClientId: '2', secret: 'my-secret' });
    const script = await routers.getRouterScript('1');
    expect(script.nasSrcAddress).toBe('10.66.0.44');
    expect(script.radiusServerIp).toBe('10.99.25.7');
    expect(script.scriptRos7).toContain('address="10.99.25.7"');
    expect(script.scriptRos7).toContain('src-address="10.66.0.44"');
    expect(script.scriptRos7).not.toContain('portmap');
    rows.get(2n).vpnType = 'legacy';
    await expect(routers.getRouterScript('1')).rejects.toThrow('WireGuard');
    await expect(routers.createRouter({ name: 'NAS', nasname: dto.vpnIp, vpnClientId: '2' })).rejects.toThrow('WireGuard');
  });

  it('preserves direct LAN connections without requiring VPN records', async () => {
    const { routers } = setup();
    vi.stubEnv('RADIUS_SERVER_IP', '192.168.10.3');
    try {
      await routers.createRouter({ name: 'Local', nasname: '192.168.10.1', secret: 'test' });
      const script = await routers.getRouterScript('1');
      expect(script.radiusServerIp).toBe('192.168.10.3');
      expect(script.nasSrcAddress).toBe('192.168.10.1');
    } finally { vi.unstubAllEnvs(); }
  });

  it('protects linked router/server identity and states without modifying external peers', async () => {
    const { service, routers, dto, addServer, nasRows, mikrotik } = setup();
    await addServer(); await service.createVpnClient(dto);
    await routers.createRouter({ name: 'NAS', nasname: dto.vpnIp, vpnClientId: '2' });
    for (const change of [{ vpnIp: '10.66.0.45' }, { isActive: false }, { deviceType: 'radius' as const }]) {
      await expect(service.updateVpnClient('2', { ...dto, ...change })).rejects.toThrow('Router / NAS');
    }
    for (const change of [{ vpnIp: '10.99.25.8' }, { isActive: false }, { deviceType: 'mikrotik' as const }]) {
      await expect(service.updateVpnClient('1', { deviceType: 'radius', vpnIp: '10.99.25.7', ...change })).rejects.toThrow('Server RADIUS masih digunakan');
    }
    await expect(service.removeVpnClient('2')).rejects.toThrow('Router / NAS');
    await expect(service.removeVpnClient('1')).rejects.toThrow('Server RADIUS masih digunakan');
    nasRows.clear();
    expect((await service.removeVpnClient('2')).message).toContain('Peer WireGuard tetap dikelola');
    await expect(service.removeVpnClient('1')).resolves.toHaveProperty('message');
    expect(mikrotik.withRouter).not.toHaveBeenCalled();
  });

  it('checks API identity and a user-named WireGuard interface without reading keys or mutating the router', async () => {
    const { service, routers, dto, addServer, write, mikrotik } = setup();
    await addServer(); await service.createVpnClient(dto);
    await expect(service.checkVpnClient('2')).rejects.toThrow('Router / NAS');
    await expect(service.checkVpnClient('1')).rejects.toThrow('MikroTik');
    await routers.createRouter({ name: 'NAS', nasname: dto.vpnIp, vpnClientId: '2' });
    expect((await service.checkVpnClient('2')).success).toBe(true);
    expect(mikrotik.withRouter.mock.calls[0][0].ipAddress).toBe(dto.vpnIp);
    expect(write.mock.calls.every(([command, params]) => command.endsWith('/print') && params?.[0].startsWith('=.proplist='))).toBe(true);
    expect(JSON.stringify(write.mock.calls)).not.toMatch(/private-key|preshared-key/);
    write.mockResolvedValueOnce([{ name: 'hEX' }]).mockResolvedValueOnce([{ name: 'wg-provider', disabled: 'true' }]);
    expect((await service.checkVpnClient('2')).success).toBe(false);
    mikrotik.withRouter.mockRejectedValueOnce(new Error('raw-sensitive-error'));
    expect(await service.checkVpnClient('2')).toEqual({ success: false, message: 'Koneksi gagal.' });
  });

  it('escapes RADIUS secrets and does not overwrite other RADIUS entries', () => {
    const script = radiusSetupScript({ id: 1, secret: 'abc"$test\\def' } as any, '10.99.25.7', '10.66.0.44', true);
    expect(script).toContain('secret="abc\\"\\$test\\\\def"');
    expect(script).not.toContain('/radius remove');
  });
});

describe('VPN HTTP access and validation', () => {
  let app: INestApplication | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });
  it('protects management and checks, validates IP/role, and removes all provisioning endpoints', async () => {
    const { service, dto } = setup();
    let role = 'admin';
    const module = await Test.createTestingModule({ controllers: [VpnClientController],
      providers: [{ provide: VpnClientService, useValue: service }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate(context: ExecutionContext) {
        if (!role) throw new UnauthorizedException();
        context.switchToHttp().getRequest().user = { role }; return true;
      } }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    const http = request(app.getHttpServer());
    for (const value of ['', 'sales', 'teknisi', 'finance', 'kolektor']) {
      role = value;
      const status = value ? 403 : 401;
      await http.get('/router/vpn-client').expect(status);
      await http.get('/router/vpn-client/options').expect(status);
      await http.post('/router/vpn-client').send(dto).expect(status);
      await http.patch('/router/vpn-client/1').send(dto).expect(status);
      await http.delete('/router/vpn-client/1').expect(status);
      await http.post('/router/vpn-client/1/check').expect(status);
    }
    role = 'admin';
    for (const path of ['vpn-server', 'vpn-client/settings', 'vpn-client/ubuntu-script', 'vpn-client/1/profile', 'vpn-client/1/script', 'vpn-client/keypair']) {
      await http.get('/router/' + path).expect(404);
    }
    for (const invalid of [{ vpnIp: 'bad' }, { vpnIp: '10.1.2.3/32' }, { deviceType: 'linux' }, { isActive: 'false' }]) {
      await http.post('/router/vpn-client').send({ ...dto, ...invalid }).expect(400);
    }
    await http.post('/router/vpn-client').send({ vpnIp: '10.1.2.3' }).expect(400);
    await http.post('/router/vpn-client').send({ ...dto, vpnIp: ' 10.66.0.44 ', clientPrivateKey: 'IGNORED', endpoint: 'IGNORED' }).expect(201);
    const list = await http.get('/router/vpn-client').expect(200);
    expect(list.body.data[0]).toMatchObject({ deviceType: 'mikrotik', vpnIp: '10.66.0.44' });
    expect(JSON.stringify(list.body)).not.toContain('IGNORED');
    expect(list.body).not.toHaveProperty('settings');
    await http.post('/router/vpn-client/invalid/check').expect(400);
    await http.get('/router/vpn-client?page=bad').expect(400);
  });
});
