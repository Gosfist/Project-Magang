import { describe, expect, it, vi } from 'vitest';
import { MainCoreService } from './main-core.service.js';

describe('Main Core optical power estimation', () => {
  async function estimate(type: 'rasio' | 'odc' | 'odp', source: number | null, parentType = 'server', port = 1, manual?: number, ratioPorts = { '1': '10%', '2': '90%' }) {
    const parent = { id: 1n, tipeTitik: parentType, redamanIn: source, children: [],
      spesifikasi: parentType === 'rasio' ? { jenis_splitter: '1:2', rasio_redaman_ports: ratioPorts } : { jenis_splitter: '1:4' } };
    const create = vi.fn().mockImplementation(async ({ data }) => ({ ...data, id: 2n, parent }));
    const service = new MainCoreService({ mainCore: { findFirst: vi.fn().mockResolvedValue(parent), create } } as any);
    await service.create(type, { namaTitik: 'Fixture', parentId: '1', parentPortOut: port, jarakKabel: 100,
      alamat: 'Fixture', redamanIn: manual, spesifikasi: type === 'rasio' ? {} : { jenis_splitter: '1:2' } });
    return create.mock.calls[0][0].data.redamanIn;
  }
  it.each(['rasio', 'odc', 'odp'] as const)('decreases -5 dBm for a 100m link to %s with the existing 1dB margin', async type => {
    expect(await estimate(type, -5)).toBe(-6.04);
  });
  it('does not invent 0 dBm when the upstream measurement is missing', async () => {
    expect(await estimate('odc', null)).toBeNull();
    expect(await estimate('odc', 0)).toBe(-1.03);
  });
  it('matches the frontend on symmetric splitters and asymmetric ratio branches', async () => {
    expect(await estimate('odc', -5, 'odc')).toBe(-12.06);
    expect(await estimate('odp', -5, 'odc')).toBe(-13.06);
    expect(await estimate('odp', -5, 'rasio', 1)).toBe(-16.04);
    expect(await estimate('odp', -5, 'rasio', 2)).toBe(-6.49);
  });
  it('preserves an explicitly entered measured power', async () => {
    expect(await estimate('odc', -5, 'server', 1, -18)).toBe(-18);
  });
  it('does not replace invalid legacy ratio data with an invented 50:50 split', async () => {
    expect(await estimate('odc', -5, 'rasio', 1, undefined, { '1': '', '2': '' })).toBeNull();
  });
});
