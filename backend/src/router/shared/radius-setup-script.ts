import type { Nas } from '@prisma/client';

function quote(value: string): string {
  let result = '"';
  for (const byte of Buffer.from(value, 'utf8')) {
    if (byte === 34 || byte === 36 || byte === 92) result += '\\' + String.fromCharCode(byte);
    else if (byte < 32 || byte > 126) result += '\\' + byte.toString(16).toUpperCase().padStart(2, '0');
    else result += String.fromCharCode(byte);
  }
  return result + '"';
}

export function radiusSetupScript(router: Nas, serverIp: string, sourceIp: string, ros7: boolean) {
  const tag = `UNZANET-RADIUS:${router.id}`;
  const params = `address=${quote(serverIp)} secret=${quote(router.secret || '')} src-address=${quote(sourceIp)} service=ppp,hotspot,login authentication-port=${router.ports || 1812} accounting-port=1813 timeout=3s${ros7 ? ' require-message-auth=no' : ''}`;
  return [
    `# UNZANET RADIUS - NAS ${router.id}, RouterOS ${ros7 ? '7' : '6'}`,
    '# Jalankan setelah IP ZeroTier sudah diberikan Central dan dapat saling terhubung.',
    '# Hanya entri bertanda NAS ini yang dibuat/diperbarui; entri RADIUS lain tetap ada.',
    '{',
    `:local entry [/radius find where comment="${tag}"];`,
    ':if ([:len $entry] > 1) do={ :error "Entri RADIUS terkelola ganda. Periksa sebelum melanjutkan."; };',
    `:if ([:len $entry] = 0) do={ /radius add ${params} comment="${tag}"; } else={ /radius set $entry ${params} disabled=no; };`,
    '/ppp aaa set use-radius=yes accounting=yes interim-update=5m;',
    '/radius incoming set accept=yes port=3799;',
    '/ip hotspot profile set [find] use-radius=yes;',
    `:local rule [/ip firewall filter find where comment="${tag}:COA"];`,
    `:if ([:len $rule] = 0) do={ /ip firewall filter add chain=input protocol=udp src-address=${quote(serverIp)} dst-port=3799 action=accept comment="${tag}:COA"; } else={ /ip firewall filter set $rule chain=input protocol=udp src-address=${quote(serverIp)} dst-port=3799 action=accept disabled=no; };`,
    `:if ([:len [/ip firewall filter find]] > 1) do={ /ip firewall filter move [find where comment="${tag}:COA"] 0; };`,
    '}',
    '# Periksa /radius print dan /radius monitor. Nonaktifkan entri LAN/WireGuard lama hanya setelah koneksi baru teruji.',
    '# Akun PPP local dengan username sama masih diprioritaskan RouterOS; gunakan akun uji tanpa secret lokal.',
  ].join('\n');
}
