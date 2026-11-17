import { describe, expect, it, vi } from 'vitest';
import { MainCoreOutputService } from './main-core-output.service.js';

function setup(type = 'odc', count = 4) {
  const db = {
    mainCore: {
      findFirst: vi.fn().mockResolvedValue({ id: 1n, tipeTitik: type, spesifikasi: { jenis_splitter: `1:${count}` } }),
      findMany: vi.fn().mockResolvedValue([{ id: 2n, namaTitik: 'Utara', tipeTitik: 'odp', parentPortOut: 1 }]),
    },
    pppoeAccount: { findMany: vi.fn().mockResolvedValue([
      { id: 10n, customerNumber: 45n, customerName: 'Ahmad', username: 'ahmad', routerNasId: 1, odpPort: 4 },
    ]) },
  };
  const network = { accountPresence: vi.fn().mockResolvedValue({ states: new Map([['ahmad', true]]), warnings: [] }) };
  return { db, network, service: new MainCoreOutputService(db as any, network as any) };
}

describe('Main Core direct outputs', () => {
  it.each(['odc', 'odp', 'rasio'])('only queries direct children/customers of the selected %s', async type => {
    const { db, service } = setup(type);
    const result = await service.list(type, '1');
    expect(db.mainCore.findFirst).toHaveBeenCalledWith({ where: { id: 1n, tipeTitik: type, deletedAt: null } });
    expect(db.mainCore.findMany.mock.calls[0][0]?.where).toEqual({ parentId: 1n, deletedAt: null });
    expect(db.pppoeAccount.findMany.mock.calls[0][0]?.where).toEqual({ odp: '1', odpPort: { not: null } });
    expect(result.data[0]).toEqual({ port: 1, destinations: [{ id: '2', name: 'Utara', type: 'odp' }], customers: [] });
    expect(result.data[1]).toEqual({ port: 2, destinations: [], customers: [] });
    expect(result.data[3].customers).toEqual([{ id: '10', customerNumber: '000045', name: 'Ahmad', online: true }]);
  });

  it('returns device outputs without inventing customers', async () => {
    const { db, service } = setup();
    db.pppoeAccount.findMany.mockResolvedValue([]);
    const result = await service.list('odc', '1');
    expect(result.data.flatMap(port => port.customers)).toEqual([]);
    expect(result.data[0].destinations).toHaveLength(1);
  });

  it.each([false, null])('preserves the accounting state %s', async online => {
    const { db, network, service } = setup('rasio', 2);
    network.accountPresence.mockResolvedValue({ states: new Map([['ahmad', online]]), warnings: ['Accounting belum diperbarui'] } as any);
    db.pppoeAccount.findMany.mockResolvedValue([{ id: 10n, customerNumber: 45n, customerName: 'Ahmad', username: 'ahmad', routerNasId: 1, odpPort: 2 }]);
    const result = await service.list('rasio', '1');
    expect(result.data).toHaveLength(2);
    expect(result.data[1].customers[0].online).toBe(online);
    expect(result.warnings).toEqual(['Accounting belum diperbarui']);
  });

  it('shows the direct Server connection even when its source port is null', async () => {
    const { db, service } = setup('server');
    db.mainCore.findFirst.mockResolvedValue({ id: 1n, tipeTitik: 'server', spesifikasi: null });
    db.mainCore.findMany.mockResolvedValue([{ id: 2n, namaTitik: 'ODC Pusat', tipeTitik: 'odc', parentPortOut: null }]);
    db.pppoeAccount.findMany.mockResolvedValue([]);
    const result = await service.list('server', '1');
    expect(result.data).toEqual([{ port: 1, destinations: [{ id: '2', name: 'ODC Pusat', type: 'odc' }], customers: [] }]);
  });

  it('shows an unused Server output when there is no direct connection', async () => {
    const { db, service } = setup('server');
    db.mainCore.findMany.mockResolvedValue([]);
    db.pppoeAccount.findMany.mockResolvedValue([]);
    const result = await service.list('server', '1');
    expect(result.data).toEqual([{ port: 1, destinations: [], customers: [] }]);
  });

  it('rejects invalid category, invalid id and missing nodes', async () => {
    const { db, service } = setup();
    await expect(service.list('invalid', '1')).rejects.toThrow('Titik tidak ditemukan');
    await expect(service.list('odc', 'abc')).rejects.toThrow('Titik tidak ditemukan');
    expect(db.mainCore.findFirst).not.toHaveBeenCalled();
    db.mainCore.findFirst.mockResolvedValue(null);
    await expect(service.list('odc', '1')).rejects.toThrow('Titik tidak ditemukan');
  });
});
