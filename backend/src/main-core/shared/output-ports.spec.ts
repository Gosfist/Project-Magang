import { describe, expect, it, vi } from 'vitest';
import { assertOutputPort, lockOutputNodes, outputPortCount } from './output-ports.js';

describe('ODC / ODP output port reservations', () => {
  const node = { id: 4n, spesifikasi: { jenis_splitter: '1:4' } };
  function setup(child: unknown = null, account: unknown = null) {
    return { mainCore: { findFirst: vi.fn().mockResolvedValue(child) }, pppoeAccount: { findFirst: vi.fn().mockResolvedValue(account) }, $queryRaw: vi.fn().mockResolvedValue([]) };
  }
  it.each([0, 5, 1.5, NaN])('rejects invalid port %s', async port => {
    const tx = setup();
    await expect(assertOutputPort(tx as any, node, port)).rejects.toThrow('Pilih port');
    expect(tx.pppoeAccount.findFirst).not.toHaveBeenCalled();
  });
  it('rejects a port already connected to another Main Core node', async () => {
    await expect(assertOutputPort(setup({ id: 8n }) as any, node, 2)).rejects.toThrow('terpakai');
  });
  it('rejects a port occupied by a customer, regardless of active state', async () => {
    const tx = setup(null, { id: 9n });
    await expect(assertOutputPort(tx as any, node, 2)).rejects.toThrow('terpakai');
    expect(tx.pppoeAccount.findFirst.mock.calls[0][0].where).not.toHaveProperty('isActive');
  });
  it('excludes the edited account and child, while checking all other reservations', async () => {
    const tx = setup();
    await assertOutputPort(tx as any, node, 2, 9n, 8n);
    expect(tx.pppoeAccount.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { odp: '4', odpPort: 2, id: { not: 9n } } }));
    expect(tx.mainCore.findFirst.mock.calls[0][0].where.id).toEqual({ not: 8n });
  });
  it('locks shared nodes in a stable order without duplicate locks', async () => {
    const tx = setup();
    await lockOutputNodes(tx as any, [4n, 2n, 4n]);
    expect(tx.$queryRaw.mock.calls.map(call => call[1])).toEqual([2n, 4n]);
  });
  it('uses only configured supported splitter counts', () => {
    expect(outputPortCount({ jenis_splitter: '1:8' })).toBe(8);
    expect(outputPortCount(null)).toBe(0);
    expect(outputPortCount({ jenis_splitter: 'invalid' })).toBe(0);
  });
});
