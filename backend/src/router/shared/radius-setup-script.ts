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
  // Preserve NAS markers: reapplying updates the same entries without deleting them.
  // New entries stay disabled until all settings have been assigned.
  const upsert = (menu: string, marker: string, initial: string, params: string) => {
    const find = `[${menu} find where comment=${q(marker)}]`;
    lines.push(
      `:if ([:len ${find}] = 0) do={ ${menu} add ${initial}disabled=yes comment=${q(marker)}; };`,
      `${menu} set ${find} ${params} disabled=no;`,
    );
  };
  if (router.vpnHost) {
    lines.push('# 1. Hubungkan VPN SSTP ke server RADIUS');
    if (router.vpnUsername && vpnPassword) {
      // Requested simple mode: no CA import or server identity verification.
      upsert('/interface sstp-client', `${tag}:VPN`, `name=${q(tunnelName)} connect-to=${q(router.vpnHost)} `,
        `name=${q(tunnelName)} connect-to=${q(router.vpnHost)} port=${vpnPort} user=${q(router.vpnUsername)} password=${q(vpnPassword)} profile=default authentication=mschap2 add-default-route=no verify-server-certificate=no verify-server-address-from-certificate=no`);
    } else {
      lines.push('# Gunakan tunnel yang sudah ada; isi password VPN untuk membuat atau memperbaruinya.');
    }
    upsert('/ip route', `${tag}:RADIUS-ROUTE`, `dst-address=${q(`${serverIp}/32`)} gateway=${q(tunnelName)} `,
      `dst-address=${q(`${serverIp}/32`)} gateway=${q(tunnelName)}`);
  }
  lines.push('# 2. Atur FreeRADIUS dan Disconnect UDP 3799');
  upsert('/radius', tag, `address=${q(serverIp)} `,
    `address=${q(serverIp)} secret=${q(router.secret)} src-address=${q(sourceIp)} service=ppp authentication-port=${router.ports || 1812} accounting-port=1813 timeout=3s`);
  lines.push(`/radius incoming set accept=yes port=${coaPort};`);
  upsert('/ip firewall filter', `${tag}:COA`, 'chain=input ',
    `chain=input protocol=udp src-address=${q(serverIp)} dst-port=${coaPort} action=accept`);
  lines.push(`:if ([:len [/ip firewall filter find]] > 1) do={ /ip firewall filter move [find where comment=${q(`${tag}:COA`)}] 0; };`);
  upsert('/ip firewall filter', `${tag}:MGMT-DENY`, 'chain=input ',
    `chain=input protocol=tcp connection-state=new src-address=${q(serverIp)} action=drop`);
  lines.push(
    `:if ([:len [/ip firewall filter find]] > 1) do={ /ip firewall filter move [find where comment=${q(`${tag}:MGMT-DENY`)}] 0; };`,
    '# 3. Aktifkan RADIUS dan accounting PPPoE',
    '/ppp aaa set use-radius=yes accounting=yes interim-update=5m;',
  );
  return lines.join('\n');
}
