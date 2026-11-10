import { describe, expect, it, vi } from 'vitest';
import { MainCoreService } from './main-core.service.js';

describe('Main Core optical power estimation', () => {
  async function estimate(type: 'rasio' | 'odc' | 'odp', source: number | null, parentType = 'server', port = 1, manual?: number, ratioPorts = { '1': '10%', '2': '90%' }, distance = 100, splitter = '1:4') {
    const parent = { id: 1n, tipeTitik: parentType, redamanIn: source, children: [],
      spesifikasi: parentType === 'rasio' ? { jenis_splitter: '1:2', rasio_redaman_ports: ratioPorts } : { jenis_splitter: splitter } };
    const create = vi.fn().mockImplementation(async ({ data }) => ({ ...data, id: 2n, parent }));
    const db = { $queryRaw: vi.fn().mockResolvedValue([]), pppoeAccount: { findFirst: vi.fn().mockResolvedValue(null) },
      mainCore: { findFirst: vi.fn().mockImplementation(async ({ where }) => where.parentId ? null : parent), create } };
    const service = new MainCoreService({ ...db, $transaction: (fn: (tx: typeof db) => Promise<unknown>) => fn(db) } as any);
    await service.create(type, { namaTitik: 'Fixture', parentId: '1', parentPortOut: port, jarakKabel: distance,
      alamat: 'Fixture', redamanIn: manual, spesifikasi: type === 'rasio' ? {} : { jenis_splitter: '1:2' } });
    return create.mock.calls[0][0].data.redamanIn;
  }
  it.each(['rasio', 'odc', 'odp'] as const)('decreases -5 dBm for a 100m link to %s with two connectors and the existing 1dB margin', async type => {
    expect(await estimate(type, -5)).toBe(-7.04);
  });
  it('does not invent 0 dBm when the upstream measurement is missing', async () => {
    expect(await estimate('odc', null)).toBeNull();
    expect(await estimate('odc', 0)).toBe(-2.04);
  });
  it('matches the frontend on symmetric splitters and asymmetric ratio branches', async () => {
    expect(await estimate('odc', -5, 'odc')).toBe(-13.06);
    expect(await estimate('odp', -5, 'odc')).toBe(-13.06);
    expect(await estimate('odp', -5, 'rasio', 1)).toBe(-17.04);
    expect(await estimate('odp', -5, 'rasio', 2)).toBe(-7.49);
  });
  it('matches the 250m calculator example at the same reference point', async () => {
    for (const type of ['rasio', 'odc', 'odp'] as const) {
      expect(await estimate(type, -6, 'server', 1, undefined, undefined, 250)).toBe(-8.09);
      expect(await estimate(type, -6, 'odc', 1, undefined, undefined, 250, '1:2')).toBe(-11.10);
    }
  });
  it('preserves an explicitly entered measured power', async () => {
    expect(await estimate('odc', -5, 'server', 1, -18)).toBe(-18);
  });
  it.each(['odc', 'odp'])('uses the %s source splitter on the next ODP segment', async parentType => {
    expect(await estimate('odp', -6, parentType, 1, undefined, undefined, 250, '1:2')).toBe(-11.10);
    expect(await estimate('odp', -6, parentType, 1, undefined, undefined, 250, '1:4')).toBe(-14.11);
  });
  it('uses only the selected asymmetric port loss for all destination categories', async () => {
    for (const type of ['rasio', 'odc', 'odp'] as const) {
      expect(await estimate(type, -6, 'rasio', 1, undefined, undefined, 250)).toBe(-18.09);
      expect(await estimate(type, -6, 'rasio', 2, undefined, undefined, 250)).toBe(-8.55);
    }
  });
  it('does not replace invalid legacy ratio data with an invented 50:50 split', async () => {
    expect(await estimate('odc', -5, 'rasio', 1, undefined, { '1': '', '2': '' })).toBeNull();
  });
});
