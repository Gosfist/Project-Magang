import { BadRequestException } from '@nestjs/common';
import { isIPv4 } from 'node:net';

export const wireguardClients = { vpnType: 'wireguard' };
export const radiusVpnClient = { ...wireguardClients, isRadiusServer: true, isActive: true };

// Provider-assigned addresses may use any IPv4 subnet; there is no fixed /24 or reserved .1.
export function assertVpnIp(ip: string) {
  const first = Number(ip.split('.')[0]);
  if (!isIPv4(ip) || first === 0 || first === 127 || first >= 224) {
    throw new BadRequestException('Gunakan IPv4 unicast VPN perangkat, bukan localhost, multicast, atau subnet / CIDR.');
  }
}
