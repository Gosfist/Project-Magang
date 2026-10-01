import { poolUsage } from './pool-usage.js';

describe('pool capacity', () => {
  it('counts inclusive ranges across subnet boundaries without subtracting gateway addresses', () => {
    expect(poolUsage('10.0.0.254-10.0.1.2', ['10.0.0.255'])).toEqual({ totalIps: 5, usedIps: 1, freeIps: 4 });
  });
  it('merges overlapping ranges and counts each allocated address once', () => {
    expect(poolUsage('10.0.0.1-10.0.0.3,10.0.0.2-10.0.0.4,10.0.0.9',
      ['10.0.0.2', '10.0.0.2', '10.0.0.9', '10.0.0.99'])).toEqual({ totalIps: 5, usedIps: 2, freeIps: 3 });
  });
  it('distinguishes an empty pool from unavailable usage', () => {
    expect(poolUsage('10.0.0.1', [])).toEqual({ totalIps: 1, usedIps: 0, freeIps: 1 });
    expect(poolUsage('10.0.0.1', null)).toEqual({ totalIps: 1, usedIps: null, freeIps: null });
    expect(poolUsage('10.0.0.1', ['10.0.0.1'])).toEqual({ totalIps: 1, usedIps: 1, freeIps: 0 });
  });
  it('does not invent counts for malformed or unsupported ranges', () => {
    for (const ranges of ['', 'bad', '10.0.0.3-10.0.0.1', '10.0.0.0/24']) {
      expect(poolUsage(ranges, [])).toEqual({ totalIps: null, usedIps: null, freeIps: null });
    }
  });
});
