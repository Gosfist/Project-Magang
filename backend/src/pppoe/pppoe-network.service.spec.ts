import { PppoeNetworkService } from './pppoe-network.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MikrotikService } from '../router/mikrotik.service.js';
import type { IpPool } from '@prisma/client';

describe('PPPoE network operations', () => {
  const pool = { id: 1n, name: 'pool-10', networkStart: '10.0.0.2', networkEnd: '10.0.0.254' } as IpPool;
  const router = { id: 3, name: 'NAS 3', nasname: '10.99.0.2', ipAddress: '10.99.0.2' };
  function setup(rows: Record<string, string>[] = []) {
    const write = vi.fn().mockResolvedValue(rows);
    const prisma = { nas: { findMany: vi.fn().mockResolvedValue([router]) }, radacct: { findMany: vi.fn().mockResolvedValue([]) } };
    const mikrotik = { withRouter: vi.fn().mockImplementation((_, action) => action(write)), errorMessage: () => 'API gagal' };
    return { service: new PppoeNetworkService(prisma as unknown as PrismaService, mikrotik as unknown as MikrotikService), prisma, mikrotik, write };
  }
  it('creates a missing pool with the configured range', async () => {
    const { service, write } = setup();
    expect(await service.syncPool(pool)).toEqual({ completed: 1, warnings: [] });
    expect(write).toHaveBeenCalledWith('/ip/pool/add', ['=name=pool-10', '=ranges=10.0.0.2-10.0.0.254', '=comment=UNZANET PPPoE']);
  });
  it('updates existing pool by internal ID without duplicating it', async () => {
    const { service, write } = setup([{ '.id': '*5', name: 'pool-10', ranges: '10.0.0.2-10.0.0.10' }]);
    await service.syncPool(pool);
    expect(write).toHaveBeenCalledWith('/ip/pool/set', ['=.id=*5', '=ranges=10.0.0.2-10.0.0.254']);
    expect(write).not.toHaveBeenCalledWith('/ip/pool/add', expect.anything());
  });
  it('makes retrying an already synchronized pool a no-op', async () => {
    const { service, write } = setup([{ '.id': '*5', name: 'pool-10', ranges: '10.0.0.2-10.0.0.254' }]);
    await service.syncPool(pool);
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('reports inaccessible routers instead of claiming sync success', async () => {
    const { service, mikrotik } = setup();
    mikrotik.withRouter.mockRejectedValue(new Error('connection refused'));
    expect(await service.syncPool(pool)).toEqual({ completed: 0, warnings: ['NAS 3: API gagal'] });
  });
  it('removes only exact username sessions using RouterOS IDs', async () => {
    const { service, write, prisma } = setup([{ '.id': '*8', name: 'andi' }, { '.id': '*9', name: 'andi2' }]);
    prisma.radacct.findMany.mockResolvedValue([{ nasipaddress: router.nasname }]);
    await service.disconnect('andi', 3);
    expect(write).toHaveBeenCalledWith('/ppp/active/remove', ['=.id=*8']);
    expect(write).not.toHaveBeenCalledWith('/ppp/active/remove', ['=.id=*9']);
    expect(prisma.nas.findMany).toHaveBeenCalledWith({ where: { OR: [{ id: 3 }, { nasname: { in: [router.nasname] } }, { ipAddress: { in: [router.nasname] } }] } });
  });
  it('reports unknown NAS rather than disconnecting an arbitrary router', async () => {
    const { service, prisma, write } = setup();
    prisma.nas.findMany.mockResolvedValue([]);
    expect((await service.disconnect('andi', null)).warnings.length).toBeGreaterThan(0);
    expect(write).not.toHaveBeenCalled();
  });
});
