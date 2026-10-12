import { describe, expect, it, vi } from 'vitest';
import { PaketLayananService } from './paket-layanan.service.js';
import { RadiusService } from '../shared/radius.service.js';

function setup() {
  let committed = false;
  const current = { id: 1n, name: 'Paket', uploadMbps: 5, downloadMbps: 5, addressPool: 'pool', ipPool: null,
    price: 110000n, costPrice: 100000n, validityDays: 30, isActive: true };
  const accounts = [{ id: 2n, username: '000002', routerNasId: 3, isActive: true, password: 'encrypted', expiresAt: null }];
  let updatedPackage = current;
  const tx = {
    appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    pppoePackage: { update: vi.fn(async ({ data }) => { updatedPackage = { ...current, ...data }; return updatedPackage; }) },
    pppoeAccount: { findMany: vi.fn(async () => accounts.map(account => ({ ...account, package: updatedPackage }))) },
    paymentPromise: { findFirst: vi.fn(async () => null) },
    radcheck: { deleteMany: vi.fn(), createMany: vi.fn() },
    radreply: { deleteMany: vi.fn(), createMany: vi.fn() },
  };
  const prisma = {
    appSetting: { findMany: vi.fn().mockResolvedValue([]) },
    pppoePackage: { findUnique: vi.fn(async () => current) },
    $transaction: vi.fn(async action => { const result = await action(tx); committed = true; return result; }),
  };
  const network = { disconnect: vi.fn(async () => { expect(committed).toBe(true); return { warnings: [] as string[], completed: 1 }; }) };
  const secrets = { decrypt: () => 'test-password' };
  const service = new PaketLayananService(prisma as any, new RadiusService(secrets as any), secrets as any, network as any);
  const dto = { name: 'Paket', downloadMbps: 20, uploadMbps: 3, addressPool: 'pool', price: 110000, costPrice: 100000, validityDays: 30 };
  return { service, tx, network, dto };
}

describe('PPPoE package network updates', () => {
  it('sends upload/download in router RX/TX order and reauthenticates only after commit', async () => {
    const { service, tx, network, dto } = setup();
    const result = await service.updatePackage('1', dto);
    expect(tx.radreply.createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      { username: '000002', attribute: 'Mikrotik-Rate-Limit', op: ':=', value: '3M/20M' },
    ]) });
    expect(network.disconnect).toHaveBeenCalledWith('000002', 3);
    expect(result.warnings).toEqual([]);
  });

  it('does not reconnect customers for price-only edits', async () => {
    const { service, network, dto } = setup();
    await service.updatePackage('1', { ...dto, downloadMbps: 5, uploadMbps: 5, price: 120000 });
    expect(network.disconnect).not.toHaveBeenCalled();
  });

  it('reauthenticates when only the IP pool changes', async () => {
    const { service, network, dto } = setup();
    await service.updatePackage('1', { ...dto, downloadMbps: 5, uploadMbps: 5, addressPool: 'pool-new' });
    expect(network.disconnect).toHaveBeenCalled();
  });

  it('reports a failed reconnect instead of hiding a still-active old session', async () => {
    const { service, network, dto } = setup();
    network.disconnect.mockResolvedValue({ warnings: ['Router tidak dapat dijangkau'], completed: 0 });
    const result = await service.updatePackage('1', dto);
    expect(result.warnings).toEqual(['Router tidak dapat dijangkau']);
    expect(result.message).toContain('Perhatian');
  });

  it('does not disconnect when the RADIUS transaction fails', async () => {
    const { service, tx, network, dto } = setup();
    tx.radreply.createMany.mockRejectedValue(new Error('RADIUS unavailable'));
    await expect(service.updatePackage('1', dto)).rejects.toThrow('RADIUS unavailable');
    expect(network.disconnect).not.toHaveBeenCalled();
  });
});
