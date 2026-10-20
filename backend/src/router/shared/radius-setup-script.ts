import type { Nas } from '@prisma/client';

export function routerOsQuote(value: string): string {
  let result = '"';
  for (const byte of Buffer.from(value, 'utf8')) {
    if (byte === 34 || byte === 36 || byte === 92) result += '\\' + String.fromCharCode(byte);
    else if (byte < 32 || byte > 126) result += '\\' + byte.toString(16).toUpperCase().padStart(2, '0');
    else result += String.fromCharCode(byte);
  }
  return result + '"';
}

export function radiusSetupScript(router: Nas, serverIp: string, sourceIp: string, _ros7: boolean, vpnPassword?: string, vpnPort = 443) {
  const q = routerOsQuote;
  const tag = `UNZANET-RADIUS:${router.id}`;
  const coaPort = router.coaPort || 3799;
  const tunnelName = `radius-cloud-${router.id}`;
  const lines: string[] = [];
  if (router.vpnHost) {
    lines.push('# 1. Hubungkan VPN SSTP ke server RADIUS');
    if (router.vpnUsername && vpnPassword) {
      // Requested simple mode: no CA import or server identity verification.
      lines.push(`/interface sstp-client add name=${q(tunnelName)} connect-to=${q(router.vpnHost)} port=${vpnPort} user=${q(router.vpnUsername)} password=${q(vpnPassword)} profile=default authentication=mschap2 add-default-route=no verify-server-certificate=no verify-server-address-from-certificate=no disabled=no comment=${q(`${tag}:VPN`)};`);
    } else {
      lines.push('# Gunakan tunnel yang sudah ada; isi password VPN hanya untuk pemasangan awal tunnel.');
    }
    lines.push(`/ip route add dst-address=${q(`${serverIp}/32`)} gateway=${q(tunnelName)} comment=${q(`${tag}:RADIUS-ROUTE`)};`);
  }
  lines.push('# 2. Atur FreeRADIUS dan Disconnect UDP 3799');
  lines.push(
    `/radius add address=${q(serverIp)} secret=${q(router.secret)} src-address=${q(sourceIp)} service=ppp authentication-port=${router.ports || 1812} accounting-port=1813 timeout=3s comment=${q(tag)};`,
    `/radius incoming set accept=yes port=${coaPort};`,
    `/ip firewall filter add chain=input protocol=udp src-address=${q(serverIp)} dst-port=${coaPort} action=accept comment=${q(`${tag}:COA`)};`,
    `/ip firewall filter add chain=input protocol=tcp connection-state=new src-address=${q(serverIp)} action=drop comment=${q(`${tag}:MGMT-DENY`)};`,
    `/ip firewall filter move [find where comment=${q(`${tag}:MGMT-DENY`)}] 0;`,
    `/ip firewall filter move [find where comment=${q(`${tag}:COA`)}] 0;`,
    '# 3. Aktifkan RADIUS dan accounting PPPoE',
    '/ppp aaa set use-radius=yes accounting=yes interim-update=5m;',
  );
  return lines.join('\n');
}
