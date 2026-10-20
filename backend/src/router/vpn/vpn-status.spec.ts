import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VpnStatusService } from './vpn-status.service.js';
const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile }));

const now = Date.parse('2026-10-20T04:00:00Z');
const router = { vpnClientId: 1n, vpnHost: '192.0.2.1', vpnUsername: 'vpn_a', nasname: '10.88.0.2' };
const snapshot = { checkedAt: new Date(now).toISOString(), available: true, sessions: [{ username: 'vpn_a', ip: '10.88.0.2' }] };
describe('SSTP status from server sessions', () => {
  const service = new VpnStatusService();
  beforeEach(() => readFile.mockReset());
  it('requires both the username and assigned IP and treats a valid empty table as offline', () => {
    expect(service.forRouter(router, snapshot, now).vpnStatus).toBe('online');
    for (const sessions of [[], [{ username: 'someone_else', ip: router.nasname }], [{ username: 'vpn_a', ip: '10.88.0.3' }]]) {
      expect(service.forRouter(router, { ...snapshot, sessions }, now).vpnStatus).toBe('offline');
    }
    // Registration flags do not prove that a tunnel is connected.
    expect(service.forRouter({ ...router, isActive: false } as any, snapshot, now).vpnStatus).toBe('online');
  });
  it('reports unavailable, stale or future data as unknown rather than offline/online', () => {
    for (const value of [null, { ...snapshot, available: false }, { ...snapshot, checkedAt: new Date(now - 45001).toISOString() }, { ...snapshot, checkedAt: new Date(now + 1).toISOString() }]) {
      expect(service.forRouter(router, value, now).vpnStatus).toBe('unknown');
    }
    expect(service.forRouter(router, snapshot, now + 45000).vpnStatus).toBe('online');
  });
  it('does not label local NAS or unobserved external VPN accounts offline', () => {
    expect(service.forRouter({ ...router, vpnClientId: null, vpnHost: null }, snapshot, now).vpnStatus).toBe('not_configured');
    expect(service.forRouter({ ...router, vpnClientId: null }, snapshot, now).vpnStatus).toBe('unknown');
  });
  it('validates the snapshot and handles missing/invalid files without breaking NAS lists', async () => {
    readFile.mockResolvedValueOnce(JSON.stringify(snapshot));
    expect(await service.snapshot()).toEqual(snapshot);
    expect(readFile).toHaveBeenCalledWith('/run/unzanet-vpn-status/sessions.json', 'utf8');
    for (const value of ['not json', '{}', JSON.stringify({ ...snapshot, sessions: [{}] }), JSON.stringify({ ...snapshot, checkedAt: 'invalid' }), JSON.stringify({ ...snapshot, available: 'yes' })]) {
      readFile.mockResolvedValueOnce(value);
      expect(await service.snapshot()).toBeNull();
    }
    readFile.mockRejectedValueOnce(new Error('ENOENT'));
    expect(await service.snapshot()).toBeNull();
  });
});
