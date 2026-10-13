import { describe, expect, it } from 'vitest';
import { emptyIsolation } from '../../pppoe/shared/isolation-config.js';
import { localScript, radiusScript, rosString, type LocalAccount } from './routeros-backup.js';

const settings = { localAddress: '192.168.75.1', baseProfile: 'internet-main' };
const account: LocalAccount = { customerNumber: '1', username: 'customer', password: 'password', pool: 'internet', rate: '5M/10M', packageId: '2', isolated: false };
describe('offline PPPoE backup scripts', () => {
  it('quotes password interpolation, quotes, backslashes, newline and UTF-8 bytes', () => {
    expect(rosString('a$"\\\nñ')).toBe('"a\\$\\"\\\\\\0A\\C3\\B1"');
    const password = '"); /system reset-configuration; #$pass';
    const script = localScript(3, [{ ...account, password }], settings, emptyIsolation(), false);
    expect(script).toContain(`password=${rosString(password)}`);
    expect(script).not.toContain('password="");');
    expect(script).not.toContain('/ppp aaa set use-radius=no');
  });
  it('checks all collisions before mutation and supplies pool, bandwidth and owned upserts', () => {
    const script = localScript(3, [account, { ...account, username: 'last', customerNumber: '2' }], settings, emptyIsolation(), false);
    expect(script.indexOf('Nama last sudah dipakai')).toBeLessThan(script.indexOf('/ppp profile add'));
    expect(script).toContain('copy-from="internet-main"');
    expect(script).toContain('remote-address="internet" rate-limit="5M/10M"');
    expect(script).toContain('UNZANET-BACKUP:3:ACCOUNT:1');
    expect(script).not.toContain('/ppp active remove');
  });
  it('keeps isolir on its dedicated pool and installs drops before generating enabled secrets', () => {
    const isolation = { enabled: true, poolName: 'isolir', subnet: '192.168.100.0/24', localAddress: '192.168.100.1', profileName: 'UNZANET-ISOLIR-3' };
    const script = localScript(3, [{ ...account, isolated: true }], settings, isolation, true);
    expect(script).toContain('remote-address="isolir"'); expect(script).toContain('use-ipv6=no');
    expect(script.match(/action=drop/g)).toHaveLength(3);
    expect(script.indexOf('action=drop')).toBeLessThan(script.indexOf('/ppp secret add'));
    expect(script).toContain('profile="UNZANET-BACKUP-3-ISOLIR-2" disabled=no');
    expect(script).toContain('/ppp active remove');
    const disabled = localScript(3, [{ ...account, isolated: true }], settings, emptyIsolation(), false);
    expect(disabled).toContain('profile="UNZANET-BACKUP-3-PKG-2" disabled=yes');
  });
  it('returns to RADIUS by disabling only managed PPPoE secrets and optionally reconnecting their sessions', () => {
    const script = radiusScript(3, true);
    expect(script).toContain('/ppp aaa set use-radius=yes');
    expect(script).toContain('comment~"^UNZANET-BACKUP:3:ACCOUNT:"');
    expect(script).toContain('service] = "pppoe"');
    expect(script).toContain('/ppp secret set $item disabled=yes');
    expect(script).not.toContain('/ppp secret remove');
    expect(script).not.toContain('password=');
    expect(radiusScript(3, false)).not.toContain('/ppp active remove');
  });
});
