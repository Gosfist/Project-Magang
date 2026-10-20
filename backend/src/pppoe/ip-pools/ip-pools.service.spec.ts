import { Prisma } from '@prisma/client';
import { IpPoolsService } from './ip-pools.service.js';
import type { PppoeNetworkService } from '../shared/pppoe-network.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

describe('Registered NAS pool plans and installation scripts', () => {
  function setup() {
    const dto = { routerNasId: 3, name: 'customers', networkStart: '10.0.0.2', networkEnd: '10.0.0.254' };
    const pool = { id: 12n, ...dto };
    const prisma = {
      appSetting: { findMany: vi.fn().mockResolvedValue([]) },
      nas: { findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true }) },
      pppoePackage: { count: vi.fn().mockResolvedValue(0) },
      ipPool: { create: vi.fn().mockImplementation(async ({ data }) => ({ id: 12n, ...data })), findUnique: vi.fn().mockResolvedValue(pool), update: vi.fn().mockImplementation(async ({ data }) => ({ id: 12n, ...data })), delete: vi.fn().mockResolvedValue(pool) },
    };
    const network = { listPools: vi.fn().mockResolvedValue({ data: [], warnings: ['registered only'] }) };
    return { service: new IpPoolsService(prisma as unknown as PrismaService, network as unknown as PppoeNetworkService), prisma, network, dto, pool };
  }
  it('registers only the chosen NAS and returns a direct add command', async () => {
    const { service, prisma, dto } = setup();
    const result = await service.createIpPool(dto);
    expect(prisma.nas.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(prisma.ipPool.create).toHaveBeenCalledWith({ data: { ...dto, createdAt: expect.any(Date), updatedAt: expect.any(Date) } });
    expect(result.script).toBe('/ip pool add name="customers" ranges="10.0.0.2-10.0.0.254" comment="UNZANET-POOL:3:12";');
  });
  it('rejects inactive NAS and reversed ranges before storing a pool', async () => {
    const { service, prisma, dto } = setup();
    await expect(service.createIpPool({ ...dto, networkStart: '10.0.1.1' })).rejects.toThrow('Awal rentang IP');
    prisma.nas.findUnique.mockResolvedValue({ id: 3, isActive: false });
    await expect(service.createIpPool(dto)).rejects.toThrow('NAS aktif');
    expect(prisma.ipPool.create).not.toHaveBeenCalled();
  });
  it('reports a per-NAS unique name conflict', async () => {
    const { service, prisma, dto } = setup();
    prisma.ipPool.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }));
    await expect(service.createIpPool(dto)).rejects.toThrow('sudah terdaftar pada NAS ini');
  });
  it('accepts database IDs and rejects obsolete RouterOS IDs without modifying data', async () => {
    const { service, prisma, dto } = setup();
    for (const id of ['3:*A', '-1', 'anything']) await expect(service.updateIpPool(id, dto)).rejects.toThrow('ID pool tidak valid');
    expect(prisma.ipPool.update).not.toHaveBeenCalled();
    const result = await service.updateIpPool('12', dto);
    expect(prisma.ipPool.findUnique).toHaveBeenCalledWith({ where: { id: 12n } });
    expect(result.script).toBe('/ip pool set [find where name="customers" and comment="UNZANET-POOL:3:12"] name="customers" ranges="10.0.0.2-10.0.0.254" next-pool=none;');
  });
  it('prevents moving a pool to another NAS', async () => {
    const { service, prisma, dto } = setup();
    await expect(service.updateIpPool('12', { ...dto, routerNasId: 4 })).rejects.toThrow('tidak dapat dipindahkan');
    expect(prisma.ipPool.update).not.toHaveBeenCalled();
  });
  it('renames using the old name and keeps the managed ownership marker', async () => {
    const { service, dto } = setup();
    const result = await service.updateIpPool('12', { ...dto, name: 'new-customers' });
    expect(result.script).toContain('find where name="customers"');
    expect(result.script).not.toMatch(/:if|:local|[{}]/);
    expect(result.script).toContain('UNZANET-POOL:3:12');
    expect(result.script).toContain('name="new-customers" ranges=');
  });
  it('escapes RouterOS interpolation, quotes and newlines in pool names', async () => {
    const { service, dto } = setup();
    const hostile = 'pool "' + '$' + '[test]' + '\n' + 'next';
    const result = await service.createIpPool({ ...dto, name: hostile });
    expect(result.script).not.toContain(hostile);
    expect(result.script).toContain(String.raw`pool \"\$[test]\0Anext`);
  });
  it('blocks renaming/removing package pools, but allows same-name range plans', async () => {
    const { service, prisma, dto } = setup();
    prisma.pppoePackage.count.mockResolvedValue(1);
    await expect(service.updateIpPool('12', { ...dto, name: 'renamed' })).rejects.toThrow('masih digunakan');
    await expect(service.removeIpPool('12')).rejects.toThrow('masih digunakan');
    expect(prisma.ipPool.delete).not.toHaveBeenCalled();
    await service.updateIpPool('12', dto);
    expect(prisma.ipPool.update).toHaveBeenCalledOnce();
  });
  it.each([{ enabled: true }, { enabled: false, syncPending: true }])('protects active or pending isolation pools: %j', async flags => {
    const { service, prisma, dto } = setup();
    prisma.appSetting.findMany.mockResolvedValue([{ key: 'pppoe_isolation_router_3', value: JSON.stringify({ ...flags, poolName: dto.name }) }]);
    await expect(service.updateIpPool('12', dto)).rejects.toThrow('Pool isolir aktif/pending');
    await expect(service.removeIpPool('12')).rejects.toThrow('Pool isolir aktif/pending');
    expect(prisma.ipPool.update).not.toHaveBeenCalled(); expect(prisma.ipPool.delete).not.toHaveBeenCalled();
  });
  it('keeps isolation protection scoped to the owner NAS', async () => {
    const { service, prisma, dto } = setup();
    prisma.appSetting.findMany.mockResolvedValue([{ key: 'pppoe_isolation_router_4', value: JSON.stringify({ enabled: true, poolName: dto.name }) }]);
    await expect(service.updateIpPool('12', dto)).resolves.toHaveProperty('script');
  });
  it('deletes the database plan and supplies a script restricted to managed name plus comment', async () => {
    const { service, prisma } = setup();
    const result = await service.removeIpPool('12');
    expect(prisma.ipPool.delete).toHaveBeenCalledWith({ where: { id: 12n } });
    expect(result.script).toBe('/ip pool remove [find where name="customers" and comment="UNZANET-POOL:3:12"];');
    expect(result.message).toContain('Penghapusan pada router memerlukan script/manual');
  });
  it('paginates registered plans without discarding device-verification warnings', async () => {
    const { service, network } = setup();
    network.listPools.mockResolvedValue({ data: Array.from({ length: 12 }, (_, id) => ({ id: String(id), name: 'customers', routerName: 'Cabang' })), warnings: ['registered only'] });
    const result = await service.ipPools('CABANG', 2);
    expect(result.data).toHaveLength(2); expect(result.meta.total).toBe(12); expect(result.warnings).toEqual(['registered only']);
  });
});
