import { describe, it, expect } from 'vitest';
import { radiusLogTime } from './radius-log-time.js';
describe('RADIUS wall time', () => {
  it('interprets 13:26 WIB once, without displaying it as 20:26', () => {
    const instant = radiusLogTime(new Date('2026-10-11T13:26:55Z'), 'WIB');
    expect(instant.toISOString()).toBe('2026-10-11T06:26:55.000Z');
    expect(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(instant)).toBe('13:26:55');
  });
  it('handles midnight and preserves milliseconds', () => {
    expect(radiusLogTime(new Date('2026-10-11T00:01:00.123Z'), 'WIB').toISOString()).toBe('2026-10-10T17:01:00.123Z');
  });
  it.each([['UTC', 0], ['WITA', 8], ['WIT', 9]])('supports %s storage', (zone, hours) => {
    const raw = new Date('2026-10-11T13:26:55Z');
    expect(radiusLogTime(raw, zone).getTime()).toBe(raw.getTime() - Number(hours) * 3600000);
  });
  it('rejects an unsupported storage zone', () => expect(() => radiusLogTime(new Date(), 'invalid')).toThrow('RADIUS_LOG_TIMEZONE'));
});
