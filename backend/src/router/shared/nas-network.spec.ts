import { describe, expect, it } from 'vitest';
import { nasNetwork, nasNetworkScript, prefixPool } from './nas-network.js';

describe('Router NAS prefix pools', () => {
  it('uses the supplied host as gateway and excludes network, gateway and broadcast', () => {
    expect(prefixPool('192.168.75.1/24', 'Internet')).toEqual({ cidr: '192.168.75.1/24', gateway: '192.168.75.1', subnet: '192.168.75.0/24', start: '192.168.75.2', end: '192.168.75.254' });
    expect(prefixPool('192.168.75.129/25', 'Internet')).toMatchObject({ subnet: '192.168.75.128/25', start: '192.168.75.130', end: '192.168.75.254' });
    expect(prefixPool('192.168.75.254/24', 'Internet')).toMatchObject({ start: '192.168.75.1', end: '192.168.75.253' });
    expect(prefixPool('192.168.75.1/30', 'Internet')).toMatchObject({ start: '192.168.75.2', end: '192.168.75.2' });
  });
  it.each(['192.168.75.0/24', '192.168.75.255/24', '192.168.75.1/31', '192.168.75.1/33', '192.168.75.1', '192.168.75.1/24/x', 'invalid/24', '127.0.0.1/24'])('rejects invalid prefix or gateway %s', value => {
    expect(() => prefixPool(value, 'Internet')).toThrow();
  });
  it('rejects equal and nested Internet/isolation subnets', () => {
    expect(() => nasNetwork(3, '192.168.75.1/24', '192.168.75.129/25')).toThrow('tumpang tindih');
    expect(() => nasNetwork(3, '192.168.75.129/25', '192.168.75.1/24')).toThrow('tumpang tindih');
  });
  it('generates short direct commands for create and edit with the same pool/profile names', () => {
    const network = nasNetwork(3, '192.168.75.1/24', '192.168.100.1/24');
    const add = nasNetworkScript(3, network, false), edit = nasNetworkScript(3, network, true);
    expect(add).toContain('/ip pool add name="Internet" ranges="192.168.75.2-192.168.75.254"');
    expect(add).toContain('copy-from=default name="UNZANET-INTERNET-3" local-address="192.168.75.1"');
    expect(add).toContain('name="UNZANET-ISOLIR-3" local-address="192.168.100.1" remote-address="pool-isolir" use-ipv6=no');
    expect(edit).toContain('/ip pool set [find where name="Internet"]');
    expect(edit).toContain('/ppp profile set [find where name="UNZANET-ISOLIR-3"]');
    expect(edit).toContain('/ip firewall filter set [find where comment="UNZANET-ISOLIR:3:OUT"]');
    for (const script of [add, edit]) {
      expect(script).not.toMatch(/:if|:local|:len|filter move/);
      expect(script).toContain('chain=forward src-address="192.168.100.0/24" action=drop');
    }
  });
});
