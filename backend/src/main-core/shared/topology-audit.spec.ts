import { describe, expect, it, vi } from 'vitest';
import { MainCoreService } from './main-core.service.js';

function setup() {
  const nodes = [
    { id: 10n, parentId: null, tipeTitik: 'server', children: [], redamanIn: null, spesifikasi: null },
    { id: 1n, parentId: 10n, tipeTitik: 'odc', children: [], redamanIn: null, spesifikasi: { jenis_splitter: '1:8' } },
    { id: 2n, parentId: 1n, parentPortOut: 8, tipeTitik: 'odp', children: [], redamanIn: null, spesifikasi: { jenis_splitter: '1:2' } },
  ];
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    mainCore: {
      findFirst: vi.fn(async ({ where }: any) => where.parentId ? nodes.find(n => n.parentId === where.parentId && (typeof where.parentPortOut === 'object' ? (n.parentPortOut ?? 0) > where.parentPortOut.gt : n.parentPortOut === where.parentPortOut)) ?? null : nodes.find(n => n.id === where.id) ?? null),
      findMany: vi.fn(async () => nodes),
      update: vi.fn(async ({ data }: any) => ({ ...nodes[1], ...data })),
    },
    pppoeAccount: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  };
  return { service: new MainCoreService({ ...db, $transaction: (fn: any) => fn(db) } as any), db, nodes };
}

describe('Topology audit regressions', () => {
  it('rejects moving a node below its own descendant', async () => {
    const { service, db } = setup();
    await expect(service.update('odc', '1', { namaTitik: 'ODC', parentId: '2', parentPortOut: 1, alamat: 'Alamat', spesifikasi: { jenis_splitter: '1:8' } })).rejects.toThrow(/siklus|turunan/);
    expect(db.mainCore.update).not.toHaveBeenCalled();
  });
  it('rejects shrinking a splitter while a child occupies a removed output', async () => {
    const { service, db } = setup();
    await expect(service.update('odc', '1', { namaTitik: 'ODC', parentId: '10', alamat: 'Alamat', spesifikasi: { jenis_splitter: '1:2' } })).rejects.toThrow(/port|Port/);
    expect(db.mainCore.update).not.toHaveBeenCalled();
  });
});
