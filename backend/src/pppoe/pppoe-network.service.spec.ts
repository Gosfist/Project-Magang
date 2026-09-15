import { PppoeNetworkService } from './pppoe-network.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MikrotikService } from '../router/mikrotik.service.js';

describe('PPPoE network operations', () => {
  const router = { id: 3, name: 'NAS 3', nasname: '10.99.0.2', ipAddress: '10.99.0.2' };
  function setup(rows: Record<string, string>[] = []) {
    const write = vi.fn().mockResolvedValue(rows);
    const prisma = { nas: { findMany: vi.fn().mockResolvedValue([router]) }, radacct: { findMany: vi.fn().mockResolvedValue([]) } };
    const mikrotik = { withRouter: vi.fn().mockImplementation((_, action) => action(write)), errorMessage: () => 'API gagal' };
    return { service: new PppoeNetworkService(prisma as unknown as PrismaService, mikrotik as unknown as MikrotikService), prisma, mikrotik, write };
  }
  it('reads pools from routers with device-specific IDs and preserves complex ranges', async () => {
    const { service, write } = setup([{ '.id': '*5', name: 'pool-10', ranges: '10.0.0.2-10.0.0.254' },
      { '.id': '*6', name: 'complex', ranges: '10.1.0.0/24,10.2.0.2' }]);
    const result = await service.listPools();
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '3:*5', routerNasId: 3, networkStart: '10.0.0.2', networkEnd: '10.0.0.254' }),
      expect.objectContaining({ id: '3:*6', ranges: '10.1.0.0/24,10.2.0.2', networkStart: '' }),
    ]));
    expect(write).toHaveBeenCalledWith('/ip/pool/print', ['=.proplist=.id,name,ranges']);
  });
  it('reports inaccessible routers when reading pools', async () => {
    const { service, mikrotik } = setup();
    mikrotik.withRouter.mockRejectedValue(new Error('connection refused'));
    expect(await service.listPools()).toEqual({ data: [], warnings: ['NAS 3: API gagal'] });
  });
  it('rejects database IDs and malformed RouterOS IDs', () => {
    const { service } = setup();
    expect(() => service.poolIdentity('1')).toThrow();
    expect(() => service.poolIdentity('3:arbitrary')).toThrow();
    expect(service.poolIdentity('3:*A')).toEqual({ routerNasId: 3, routerId: '*A' });
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
