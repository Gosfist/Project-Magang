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
    for (const suffix of ['ROUTER', 'IN', 'OUT']) expect(script).toContain(`comment="UNZANET-BACKUP:3:FIREWALL:${suffix}"`);
    expect(script).not.toContain('comment="UNZANET-ISOLIR:');
    expect(script.indexOf('action=drop')).toBeLessThan(script.indexOf('/ppp secret add'));
    expect(script).toContain('profile="UNZANET-BACKUP-3-ISOLIR-2" disabled=no');
    expect(script).toContain('/ppp active remove');
    const disabled = localScript(3, [{ ...account, isolated: true }], settings, emptyIsolation(), false);
    expect(disabled).toContain('profile="UNZANET-BACKUP-3-PKG-2" disabled=yes');
  });
  it('returns to RADIUS by deleting only managed PPPoE secrets before reconnecting their sessions', () => {
    const script = radiusScript(3);
    expect(script).toContain('/ppp aaa set use-radius=yes');
    expect(script).toContain('comment~"^UNZANET-BACKUP:3:ACCOUNT:"');
    expect(script).toContain('service] = "pppoe"');
    expect(script).toContain('/ppp secret remove $item');
    expect(script).not.toContain('disabled=yes');
    expect(script.indexOf('/ppp secret remove $item')).toBeLessThan(script.indexOf('/ppp active remove'));
    expect(script).toContain('Secrets cadangan dihapus.');
    expect(script).not.toContain('password=');
    expect(script).toContain('/ppp active find where name=$user and service="pppoe"');
    expect(script).not.toContain('/queue remove');
  });
  it('cleans normal and isolated backup profiles for this router, including stale profiles without secrets', () => {
    const script = radiusScript(3);
    const commentPattern = new RegExp(script.match(/\/ppp profile find where comment~"([^"]+)"/)![1]);
    const namePattern = new RegExp(script.match(/and name~"([^"]+)"/)![1]);
    const names = ['UNZANET-BACKUP-3-PKG-2', 'UNZANET-BACKUP-3-ISOLIR-2', 'UNZANET-BACKUP-3-PKG-old', 'UNZANET-BACKUP-30-PKG-2', 'UNZANET-BACKUP-4-PKG-2', 'UNZANET-ISOLIR-3', 'default', 'Paket 5Mb'];
    expect(names.filter(name => namePattern.test(name))).toEqual(names.slice(0, 3));
    expect(commentPattern.test('UNZANET-BACKUP:3:PROFILE:UNZANET-BACKUP-3-PKG-old')).toBe(true);
    expect(commentPattern.test('UNZANET-BACKUP:30:PROFILE:UNZANET-BACKUP-30-PKG-2')).toBe(false);
    expect(script).toContain('comment] = ("UNZANET-BACKUP:3:PROFILE:" . $backupProfileName)');
    expect(script.indexOf('/ppp secret remove $item')).toBeLessThan(script.indexOf('/ppp profile remove $backupProfile'));
    expect(script.indexOf('/ppp active remove')).toBeLessThan(script.indexOf('/ppp profile remove $backupProfile'));
    expect(script).not.toMatch(/\/ip pool|\/queue|\/interface .* (set|remove)/);
  });
  it('preserves profiles referenced by other secrets or PPPoE servers and reports cleanup failures', () => {
    const script = radiusScript(3);
    const deletion = script.indexOf('/ppp profile remove $backupProfile');
    expect(script.indexOf('/ppp secret find where profile=$backupProfileName')).toBeLessThan(deletion);
    expect(script.indexOf('/interface pppoe-server server find where default-profile=$backupProfileName')).toBeLessThan(deletion);
    expect(script).toContain('Profil cadangan dilewati karena masih direferensikan:');
    expect(script).toContain('on-error={');
    expect(script).toContain('Profil cadangan belum dapat dihapus oleh router:');
    expect(script).toContain('"Profil cadangan dihapus: " . $removedProfiles . "; dilewati: " . $keptProfiles');
  });
  it('covers every backup configuration menu and removes only the three exact backup firewall tags', () => {
    const isolation = { enabled: true, poolName: 'isolir', subnet: '192.168.100.0/24', localAddress: '192.168.100.1', profileName: 'UNZANET-ISOLIR-3' };
    const local = localScript(3, [account, { ...account, customerNumber: '2', username: 'isolated', isolated: true }], settings, isolation, true);
    const importedMenus = [...new Set([...local.matchAll(/(\/(?:[a-z-]+ )+)(?:add|set|move|remove)\b/g)].map(match => match[1].trim()))];
    expect(importedMenus.sort()).toEqual(['/ip firewall filter', '/ppp active', '/ppp profile', '/ppp secret']);
    const radius = radiusScript(3);
    for (const menu of importedMenus) expect(radius).toContain(menu + ' remove');
    const tags = [...radius.matchAll(/\/ip firewall filter find where comment="([^"]+)"/g)].map(match => match[1]);
    expect(tags).toEqual(['UNZANET-BACKUP:3:FIREWALL:ROUTER', 'UNZANET-BACKUP:3:FIREWALL:IN', 'UNZANET-BACKUP:3:FIREWALL:OUT']);
    expect(radius).not.toContain('comment="UNZANET-ISOLIR:');
    expect(radius.indexOf('/ppp profile remove')).toBeLessThan(radius.indexOf('/ip firewall filter remove'));
    expect(radius).toContain('Firewall cadangan belum dapat dihapus oleh router.');
    expect(radius).toContain('($keptProfiles = 0) && ($keptRules = 0)');
    expect(radius).toContain('Pembersihan backup belum lengkap.');
  });
});
