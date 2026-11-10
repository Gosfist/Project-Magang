import { describe, expect, it, vi } from 'vitest';
import { DataPelangganService } from './data-pelanggan.service.js';

describe('Activation ODC / ODP port options', () => {
  it('lists all outputs and distinguishes customer and topology reservations', async () => {
    const nodes = [
      { id: 1n, parentId: null, routerNasId: 3, namaTitik: 'Server', tipeTitik: 'server' },
      { id: 4n, parentId: 1n, routerNasId: null, namaTitik: 'ODC', tipeTitik: 'odc', spesifikasi: { jenis_splitter: '1:4' } },
      { id: 5n, parentId: 4n, parentPortOut: 3, namaTitik: 'ODP', tipeTitik: 'odp', spesifikasi: { jenis_splitter: '1:2' } },
    ];
    const prisma = {
      mainCore: { findMany: vi.fn().mockResolvedValue(nodes) },
      pppoeAccount: { findMany: vi.fn().mockResolvedValue([{ id: 9n, odp: '4', odpPort: 2 }]) },
      nas: { findMany: vi.fn().mockResolvedValue([{ id: 3, shortname: 'Router' }]) },
    };
    const service = new DataPelangganService(prisma as any, {} as any, {} as any, {} as any);
    const result = await service.odpOptions();
    expect(result.data.find(item => item.id === '4' as any)?.ports).toEqual([
      { number: 1, used: false, accountId: null },
      { number: 2, used: true, accountId: '9' },
      { number: 3, used: true, accountId: null },
      { number: 4, used: false, accountId: null },
    ]);
    expect(prisma.pppoeAccount.findMany.mock.calls[0][0].where).not.toHaveProperty('isActive');
  });
});
