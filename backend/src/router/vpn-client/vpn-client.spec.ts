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
import { zeroTierJoinScript } from './zerotier-script.js';
import { radiusSetupScript } from '../shared/radius-setup-script.js';

const networkId = '0123456789abcdef';
function setup() {
  const rows = new Map<bigint, any>();
  const nasRows = new Map<number, any>();
  let nextId = 1n;
  function matches(row: any, where: any = {}): boolean {
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && 'not' in value) return row[key] !== value.not;
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
    findMany: vi.fn(async (args: any) => [...rows.values()].filter(row => matches(row, args?.where)).map(row => select(row, args?.select))),
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
      if (row && args.include?.vpnClient) return { ...row, vpnClient: rows.get(row.vpnClientId) };
      return row;
    }),
    count: vi.fn(async (args: any) => [...nasRows.values()].filter(row => rows.get(row.vpnClientId)?.networkId === args.where.vpnClient.networkId).length),
    create: vi.fn(async (args: any) => { const row = { id: nasRows.size + 1, ...args.data }; nasRows.set(row.id, row); return row; }),
  };
  const prisma: any = { vpnClient, nas };
  prisma.$transaction = vi.fn(async (action: any) => Array.isArray(action) ? Promise.all(action) : action(prisma));
  const write = vi.fn(async (command: string) => command === '/zerotier/interface/print'
    ? [{ name: 'zt1', network: networkId, status: 'OK' }] : [{ interface: 'zt1', address: '10.88.0.2/24' }]);
  const mikrotik = { withRouter: vi.fn(async (_router: any, action: any) => action(write)), errorMessage: () => 'Koneksi gagal.' };
  const service = new VpnClientService(prisma, mikrotik as any);
  const routers = new RoutersService(prisma, mikrotik as any);
  const dto = { name: 'Router', networkId, deviceType: 'mikrotik', vpnIp: '', nodeId: '', isActive: true };
  const addRouter = (index: number) => service.createVpnClient({ ...dto, name: `Cabang ${index}`, vpnIp: `10.88.0.${index + 1}`, nodeId: index.toString(16).padStart(10, '0') });
  const addServer = () => service.createVpnClient({ ...dto, name: 'Ubuntu', deviceType: 'linux', isRadiusServer: true, vpnIp: '10.88.0.1', nodeId: 'abcdef1234' });
  return { service, routers, prisma, rows, nasRows, dto, addRouter, addServer, write, mikrotik };
}

describe('ZeroTier client management', () => {
  it('reserves Ubuntu before registration, allows nine routers plus Ubuntu and rejects an eleventh device', async () => {
    const { service, addRouter, addServer, dto } = setup();
    for (let index = 1; index <= 9; index++) await addRouter(index);
    expect((await service.vpnClients()).capacity).toMatchObject({ used: 10, remaining: 0, serverRegistered: false });
    await expect(service.createVpnClient({ ...dto, isActive: false })).rejects.toThrow('Batas 10');
    await addServer();
    expect((await service.vpnClients()).capacity).toMatchObject({ used: 10, serverRegistered: true });
    await expect(service.createVpnClient(dto)).rejects.toThrow('Batas 10');
  });

  it('counts inactive clients and devices other than routers', async () => {
    const { service, dto } = setup();
    await service.createVpnClient({ ...dto, deviceType: 'other', isActive: false });
    expect((await service.vpnClients()).capacity.used).toBe(2);
  });

  it('uses serializable transactions and retries a serialization conflict', async () => {
    const { service, prisma, dto } = setup();
    prisma.$transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('retry', { code: 'P2034', clientVersion: '6.12.0' }));
    await service.createVpnClient(dto);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('rejects a second server, a different network, duplicate IPs and duplicate node IDs', async () => {
    const { service, addServer, addRouter, dto } = setup();
    await addServer();
    await expect(addServer()).rejects.toThrow('satu perangkat server RADIUS');
    await addRouter(1);
    await expect(service.createVpnClient({ ...dto, networkId: 'fedcba9876543210' })).rejects.toThrow('satu Network ID');
    await expect(service.createVpnClient({ ...dto, vpnIp: '10.88.0.2' })).rejects.toThrow('IP ZeroTier');
    await expect(service.createVpnClient({ ...dto, nodeId: '0000000001' })).rejects.toThrow('Device ID');
    await expect(service.createVpnClient({ ...dto, isRadiusServer: true })).rejects.toThrow('Ubuntu / Linux');
  });

  it('does not offer incomplete clients or Ubuntu as a MikroTik NAS option', async () => {
    const { service, addServer, addRouter, dto } = setup();
    await addServer();
    await addRouter(1);
    await service.createVpnClient(dto);
    expect((await service.vpnClientOptions()).data.map(row => row.name)).toEqual(['Cabang 1']);
  });

  it('does not expose legacy private keys and can convert a detached legacy record', async () => {
    const { service, rows, dto } = setup();
    rows.set(99n, { id: 99n, name: 'Lama', networkId: null, clientPrivateKey: 'DO-NOT-EXPOSE', clientPublicKey: 'OLD', deviceType: 'mikrotik', vpnIp: '10.2.0.2' });
    const result = await service.vpnClients();
    expect(JSON.stringify(result)).not.toContain('DO-NOT-EXPOSE');
    expect(result.capacity.used).toBe(1);
    await expect(service.getVpnClientScript('99')).rejects.toThrow('WireGuard lama');
    await service.updateVpnClient('99', dto);
    expect(rows.get(99n)).toMatchObject({ networkId, vpnServerId: null, clientPrivateKey: null });
  });

  it('protects linked router identity, deletion, and the RADIUS server address', async () => {
    const { service, addRouter, addServer, nasRows, dto } = setup();
    await addServer(); await addRouter(1);
    nasRows.set(1, { id: 1, vpnClientId: 2n, name: 'NAS' });
    await expect(service.removeVpnClient('2')).rejects.toThrow('digunakan Router');
    await expect(service.updateVpnClient('2', { ...dto, vpnIp: '10.88.0.99' })).rejects.toThrow('Lepaskan hubungan');
    await expect(service.removeVpnClient('1')).rejects.toThrow('digunakan Router');
    await expect(service.updateVpnClient('1', { ...dto, deviceType: 'linux', isRadiusServer: true, vpnIp: '10.88.0.99' })).rejects.toThrow('masih digunakan');
  });

  it('uses the selected MikroTik IP for API/NAS and Ubuntu ZeroTier IP for the RADIUS script', async () => {
    const { routers, addRouter, addServer, dto } = setup();
    await addServer(); await addRouter(1);
    const result = await routers.createRouter({ name: 'NAS A', nasname: '192.168.10.1', ipAddress: '192.168.10.1', vpnClientId: '2', secret: 'test-only', username: 'api', password: 'test-only' });
    expect(result.router).toMatchObject({ nasname: '10.88.0.2', ipAddress: '10.88.0.2' });
    const scripts = await routers.getRouterScript('1');
    expect(scripts).toMatchObject({ radiusServerIp: '10.88.0.1', nasSrcAddress: '10.88.0.2' });
    expect(scripts.scriptRos7).toContain('address="10.88.0.1"');
    expect(scripts.scriptRos7).toContain('src-address="10.88.0.2"');
    await expect(routers.createRouter({ name: 'Wrong', nasname: '192.168.1.1', vpnClientId: '1' })).rejects.toThrow('MikroTik aktif');
  });

  it('checks only network/IP via API and reports failures without claiming RADIUS proof', async () => {
    const { service, addServer, addRouter, nasRows, write } = setup();
    await addServer(); await addRouter(1);
    nasRows.set(1, { id: 1, vpnClientId: 2n, ipAddress: '10.88.0.2' });
    expect(await service.checkVpnClient('2')).toMatchObject({ success: true });
    expect(write.mock.calls.every(([command]) => command.endsWith('/print'))).toBe(true);
    write.mockResolvedValueOnce([{ name: 'zt1', network: networkId, status: 'ACCESS_DENIED' }] as any);
    expect(await service.checkVpnClient('2')).toMatchObject({ success: false });
  });

  it('produces join scripts without sending mutations to devices', async () => {
    const { service, addServer, addRouter, mikrotik } = setup();
    await addServer(); await addRouter(1);
    expect((await service.getVpnClientScript('1')).script).toContain(`sudo zerotier-cli join ${networkId}`);
    const script = (await service.getVpnClientScript('2')).script;
    expect(script).toContain('allow-default=no');
    expect(script).toContain('src-address=10.88.0.1');
    expect(script).not.toContain('chain=forward');
    expect(script).not.toContain('private-key');
    expect(mikrotik.withRouter).not.toHaveBeenCalled();
  });

  it('rejects injected script fields and escapes RADIUS secrets', () => {
    expect(() => zeroTierJoinScript({ id: 1n, networkId: 'bad; /system reboot', deviceType: 'mikrotik' }, '', 8728)).toThrow('Network ID');
    expect(() => zeroTierJoinScript({ id: 1n, networkId, deviceType: 'mikrotik' }, '1.2.3.4;evil', 8728)).toThrow('IP server');
    const script = radiusSetupScript({ id: 1, secret: 'abc"$test\\def' } as any, '10.88.0.1', '10.88.0.2', true);
    expect(script).toContain('secret="abc\\"\\$test\\\\def"');
    expect(script).not.toContain('/radius remove');
  });
});

describe('VPN HTTP access and validation', () => {
  let app: INestApplication | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });
  it('keeps management admin-only, validates ZeroTier IDs, and removes old server/keypair routes', async () => {
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
      await http.get('/router/vpn-client').expect(value ? 403 : 401);
      await http.post('/router/vpn-client').send(dto).expect(value ? 403 : 401);
      await http.post('/router/vpn-client/1/check').expect(value ? 403 : 401);
    }
    role = 'admin';
    await http.get('/router/vpn-server').expect(404);
    await http.get('/router/vpn-client/keypair').expect(404);
    for (const invalid of [{ networkId: 'bad' }, { nodeId: 'nothex' }, { vpnIp: 'bad' }, { isRadiusServer: 'false' }, { name: ' ' }]) {
      await http.post('/router/vpn-client').send({ ...dto, ...invalid }).expect(400);
    }
    await http.post('/router/vpn-client').send({ ...dto, networkId: networkId.toUpperCase() }).expect(201);
    await http.get('/router/vpn-client/invalid/script').expect(400);
  });
});
