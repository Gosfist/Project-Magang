import { describe, expect, it, vi } from 'vitest';
import { RadiusService } from './radius.service.js';
import { isolationProfile } from './isolation-config.js';
import { activeNetworkKey, nasNetwork } from '../../router/shared/nas-network.js';

describe('RADIUS pool isolation', () => {
  function setup(enabled = true) {
    const config = { enabled, poolName: 'pool-isolir', subnet: '192.168.100.0/24', localAddress: '192.168.100.1', profileName: isolationProfile(3) };
    const tx = {
      appSetting: { findUnique: vi.fn(async ({ where }) => where.key.startsWith('pppoe_isolation_router_') ? { value: JSON.stringify(config) } : null) },
      paymentPromise: { findFirst: vi.fn().mockResolvedValue(null) },
      radcheck: { deleteMany: vi.fn(), createMany: vi.fn() }, radreply: { deleteMany: vi.fn(), createMany: vi.fn() },
    };
    const account = { id: 1n, routerNasId: 3, username: '000001', password: 'encrypted', isActive: false, expiresAt: new Date('2020-01-01'), package: { isActive: true, uploadMbps: 5, downloadMbps: 10, addressPool: 'internet' } };
    const service = new RadiusService({ decrypt: () => 'test-password' } as any);
    return { tx, account, service, config };
  }
  it('keeps valid credentials without Expiration and chooses the isolated pool/profile', async () => {
    const { tx, account, service } = setup();
    await service.sync(tx as any, account as any);
    expect(tx.radcheck.createMany.mock.calls[0][0].data).toEqual([
      { username: '000001', attribute: 'Cleartext-Password', op: ':=', value: 'test-password' },
      { username: '000001', attribute: 'Simultaneous-Use', op: ':=', value: '1' },
    ]);
    expect(tx.radreply.createMany.mock.calls[0][0].data).toContainEqual({ username: '000001', attribute: 'Framed-Pool', op: ':=', value: 'pool-isolir' });
    expect(tx.radreply.createMany.mock.calls[0][0].data).toContainEqual({ username: '000001', attribute: 'Mikrotik-Group', op: ':=', value: 'UNZANET-ISOLIR-3' });
  });
  it('uses the normal package pool during a valid promise and isolates after its deadline', async () => {
    const { tx, account, service } = setup(); account.isActive = true;
    tx.paymentPromise.findFirst.mockResolvedValue({ deadline: new Date(Date.now() + 3600000) });
    await service.sync(tx as any, account as any);
    expect(tx.radreply.createMany.mock.calls[0][0].data).toContainEqual(expect.objectContaining({ attribute: 'Framed-Pool', value: 'internet' }));
    expect(tx.radreply.createMany.mock.calls[0][0].data.some((row: any) => row.attribute === 'Mikrotik-Group')).toBe(false);
    tx.paymentPromise.findFirst.mockResolvedValue({ deadline: new Date(Date.now() - 1) });
    await service.sync(tx as any, account as any);
    expect(tx.radreply.createMany.mock.calls[1][0].data).toContainEqual(expect.objectContaining({ attribute: 'Framed-Pool', value: 'pool-isolir' }));
  });
  it('removes isolation attributes after access is restored', async () => {
    const { tx, account, service } = setup();
    await service.sync(tx as any, account as any);
    account.isActive = true; account.expiresAt = new Date(Date.now() + 86400000);
    await service.sync(tx as any, account as any);
    expect(tx.radreply.deleteMany).toHaveBeenCalledTimes(2);
    expect(tx.radreply.createMany.mock.calls[1][0].data).toContainEqual(expect.objectContaining({ attribute: 'Framed-Pool', value: 'internet' }));
    expect(tx.radreply.createMany.mock.calls[1][0].data.some((row: any) => row.attribute === 'Mikrotik-Group')).toBe(false);
  });
  it('preserves denial for inactive accounts until isolation has been configured on their router', async () => {
    const { tx, account, service } = setup(false);
    await service.sync(tx as any, account as any);
    expect(tx.radcheck.createMany).not.toHaveBeenCalled();
    expect(tx.radreply.createMany).not.toHaveBeenCalled();
  });
  it('fails a corrupt enabled configuration instead of giving isolated accounts a normal pool', async () => {
    const { tx, account, service } = setup();
    tx.appSetting.findUnique.mockResolvedValue({ value: '{broken' });
    await expect(service.sync(tx as any, account as any)).rejects.toThrow('Konfigurasi pool isolir');
    expect(tx.radreply.createMany).not.toHaveBeenCalled();
  });
  it('uses NAS Internet pool/profile only after installation and keeps isolation on the same NAS', async () => {
    const { tx, account, service, config } = setup();
    account.isActive = true; account.expiresAt = new Date('2099-01-01');
    let installed = false;
    const network = nasNetwork(3, '192.168.75.1/24', '192.168.100.1/24');
    tx.appSetting.findUnique.mockImplementation(async ({ where }) => {
      if (where.key.startsWith('pppoe_isolation_router_')) return { value: JSON.stringify(config) };
      return installed && where.key === activeNetworkKey(3) ? { value: JSON.stringify(network) } : null;
    });
    await service.sync(tx as any, account as any);
    expect(tx.radreply.createMany.mock.calls.at(-1)![0].data).toContainEqual(expect.objectContaining({ attribute: 'Framed-Pool', value: 'internet' }));
    installed = true;
    await service.sync(tx as any, account as any);
    expect(tx.radreply.createMany.mock.calls.at(-1)![0].data).toEqual(expect.arrayContaining([
      expect.objectContaining({ attribute: 'Framed-Pool', value: 'Internet' }),
      expect.objectContaining({ attribute: 'Mikrotik-Group', value: 'UNZANET-INTERNET-3' }),
    ]));
    account.isActive = false;
    await service.sync(tx as any, account as any);
    expect(tx.radreply.createMany.mock.calls.at(-1)![0].data).toEqual(expect.arrayContaining([
      expect.objectContaining({ attribute: 'Framed-Pool', value: 'pool-isolir' }),
      expect.objectContaining({ attribute: 'Mikrotik-Group', value: 'UNZANET-ISOLIR-3' }),
    ]));
    account.isActive = true;
    await service.sync(tx as any, account as any);
    expect(tx.radreply.createMany.mock.calls.at(-1)![0].data).toEqual(expect.arrayContaining([
      expect.objectContaining({ attribute: 'Framed-Pool', value: 'Internet' }),
      expect.objectContaining({ attribute: 'Mikrotik-Group', value: 'UNZANET-INTERNET-3' }),
      expect.objectContaining({ attribute: 'Mikrotik-Rate-Limit', value: '5M/10M' }),
    ]));
  });
});
