import { describe, expect, it, vi } from 'vitest';
import { FirewallService } from './firewall.service.js';

describe('RouterOS firewall management', () => {
  function setup(row: Record<string, string> = { '.id': '*A', chain: 'forward', action: 'drop' }) {
    const write = vi.fn().mockImplementation(async (path: string) => path.endsWith('/print') ? [row, { '.id': '*B', chain: 'forward' }] : []);
    const prisma = { nas: { findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true }) } };
    const mikrotik = { withRouter: vi.fn((router, action) => action(write)), errorMessage: () => 'API gagal' };
    return { service: new FirewallService(prisma as any, mikrotik as any), write, prisma, mikrotik };
  }
  it.each(['filter', 'nat', 'mangle', 'raw', 'address-list'])('reads %s directly from the selected router', async table => {
    const { service, write, prisma } = setup();
    await service.list(3, 'ip', table);
    expect(prisma.nas.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(write).toHaveBeenCalledWith(`/ip/firewall/${table}/print`);
  });
  it('edits by stable RouterOS ID and preserves complex field values', async () => {
    const { service, write } = setup();
    await service.update(3, 'ip', 'filter', '*A', { 'connection-state': 'established,related', comment: 'customer=example; no script' });
    expect(write).toHaveBeenCalledWith('/ip/firewall/filter/set', ['=.id=*A', '=connection-state=established,related', '=comment=customer=example; no script']);
    await service.move(3, 'ip', 'filter', '*A', 'end');
    expect(write).toHaveBeenCalledWith('/ip/firewall/filter/move', ['=.id=*A']);
  });
  it.each([{ dynamic: 'true' }, { builtin: 'true' }, { comment: 'UNZANET-ISOLIR:3:OUT' }])('protects router and managed isolation rules %j', async extra => {
    const { service, write } = setup({ '.id': '*A', ...extra });
    await expect(service.remove(3, 'ip', 'filter', '*A')).rejects.toThrow();
    await expect(service.update(3, 'ip', 'filter', '*A', { disabled: 'yes' })).rejects.toThrow();
    expect(write).not.toHaveBeenCalledWith('/ip/firewall/filter/remove', expect.anything());
    expect(write).not.toHaveBeenCalledWith('/ip/firewall/filter/set', expect.anything());
  });
  it('rejects command-path injection, numeric row positions and control properties', async () => {
    const { service, write } = setup();
    expect(() => service.list(3, '../system', 'filter')).toThrow();
    expect(() => service.create(3, 'ip', 'filter', { 'place-before': '*A' })).toThrow();
    expect(() => service.create(3, 'ip', 'filter', { comment: 'x\n/system/reset-configuration' })).toThrow();
    await expect(service.remove(3, 'ip', 'filter', '0')).rejects.toThrow('ID rule');
    expect(write.mock.calls.some(([command]) => command.includes('/remove'))).toBe(false);
  });
  it('cannot move an ordinary rule ahead of managed drops even after external reordering', async () => {
    const { service, write } = setup();
    write.mockImplementation(async path => path.endsWith('/print') ? [
      { '.id': '*A', action: 'accept' }, { '.id': '*B', action: 'drop' }, { '.id': '*C', comment: 'UNZANET-ISOLIR:3:OUT' },
    ] : []);
    await expect(service.move(3, 'ip', 'filter', '*A', '*B')).rejects.toThrow('setelah rule isolir');
    expect(write.mock.calls.some(([command]) => command.endsWith('/move'))).toBe(false);
  });
});
