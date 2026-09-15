import { PppoeService } from './pppoe.service.js';
import { PppoeNetworkService } from './pppoe-network.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { MikrotikService } from '../router/mikrotik.service.js';
import type { RadiusService } from './radius.service.js';
import type { SecretService } from './secret.service.js';

describe('Direct MikroTik pool management', () => {
  function setup() {
    const write = vi.fn().mockResolvedValue([]);
    const router = { id: 3, isActive: true };
    const prisma = {
      nas: { findUnique: vi.fn().mockResolvedValue(router) },
      pppoePackage: { count: vi.fn().mockResolvedValue(0) },
      ipPool: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    };
    const mikrotik = { withRouter: vi.fn().mockImplementation((_, action) => action(write)), errorMessage: () => 'API gagal' };
    const network = new PppoeNetworkService(prisma as unknown as PrismaService, mikrotik as unknown as MikrotikService);
    const service = new PppoeService(prisma as unknown as PrismaService, {} as RadiusService, {} as SecretService, network);
    const dto = { routerNasId: 3, name: 'customers', networkStart: '10.0.0.2', networkEnd: '10.0.0.254' };
    return { service, prisma, mikrotik, write, dto };
  }
  it('creates on the selected router without writing a database pool', async () => {
    const { service, prisma, write, dto } = setup();
    await service.createIpPool(dto);
    expect(prisma.nas.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(write).toHaveBeenCalledWith('/ip/pool/add', ['=name=customers', '=ranges=10.0.0.2-10.0.0.254', '=comment=UNZANET PPPoE']);
    expect(prisma.ipPool.create).not.toHaveBeenCalled();
  });
  it('fails a save when MikroTik is unreachable', async () => {
    const { service, mikrotik, dto, prisma } = setup();
    mikrotik.withRouter.mockRejectedValue(new Error('offline'));
    await expect(service.createIpPool(dto)).rejects.toThrow('API gagal');
    expect(prisma.ipPool.create).not.toHaveBeenCalled();
  });
  it('rejects duplicate names and reversed ranges before adding', async () => {
    const { service, write, dto } = setup();
    write.mockResolvedValue([{ '.id': '*A', name: dto.name }]);
    await expect(service.createIpPool(dto)).rejects.toThrow('Nama pool sudah digunakan');
    await expect(service.createIpPool({ ...dto, networkStart: '10.0.1.1' })).rejects.toThrow('Network Start');
    expect(write).not.toHaveBeenCalledWith('/ip/pool/add', expect.anything());
  });
  it('updates and removes only the pool ID on its router', async () => {
    const { service, write, dto, prisma } = setup();
    write.mockResolvedValue([{ '.id': '*A', name: dto.name }]);
    await service.updateIpPool('3:*A', dto);
    expect(write).toHaveBeenCalledWith('/ip/pool/set', ['=.id=*A', '=name=customers', '=ranges=10.0.0.2-10.0.0.254']);
    await service.removeIpPool('3:*A');
    expect(write).toHaveBeenCalledWith('/ip/pool/remove', ['=.id=*A']);
    expect(prisma.ipPool.update).not.toHaveBeenCalled();
    expect(prisma.ipPool.delete).not.toHaveBeenCalled();
  });
  it('blocks renaming or removing pools used by a package', async () => {
    const { service, write, dto, prisma } = setup();
    write.mockResolvedValue([{ '.id': '*A', name: dto.name }]);
    prisma.pppoePackage.count.mockResolvedValue(1);
    await expect(service.updateIpPool('3:*A', { ...dto, name: 'renamed' })).rejects.toThrow('masih digunakan');
    await expect(service.removeIpPool('3:*A')).rejects.toThrow('masih digunakan');
    expect(write).not.toHaveBeenCalledWith('/ip/pool/remove', expect.anything());
    expect(write).not.toHaveBeenCalledWith('/ip/pool/set', expect.anything());
  });
});
