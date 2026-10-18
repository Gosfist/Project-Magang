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

export function radiusSetupScript(router: Nas, serverIp: string, sourceIp: string, ros7: boolean, vpnPassword?: string) {
  const q = routerOsQuote;
  const tag = `UNZANET-RADIUS:${router.id}`;
  const coaPort = router.coaPort || 3799;
  const tunnelName = `radius-cloud-${router.id}`;
  const lines = [
    `# UNZANET Zero-MikroTik API - NAS ${router.id}, RouterOS ${ros7 ? '7' : '6'}`,
    '# Script berisi shared secret RADIUS: simpan hanya di lokasi tepercaya.',
    '# PPPoE server, profil dasar/local-address, serta pool pelanggan harus sudah tersedia.',
    '# NAS baru/perubahan secret diterapkan server dalam sekitar 60 detik; periksa FreeRADIUS.',
    '{',
  ];
  if (router.vpnHost && router.vpnUsername && vpnPassword) {
    const params = `name=${q(tunnelName)} connect-to=${q(router.vpnHost)} user=${q(router.vpnUsername)} password=${q(vpnPassword)} profile=default add-default-route=no verify-server-certificate=yes verify-server-address-from-certificate=yes disabled=no`;
    lines.push(
      '# Sertifikat CA VPN harus sudah dipercaya router; verifikasi sertifikat tidak dimatikan.',
      `:local tunnel [/interface sstp-client find where comment=${q(`${tag}:VPN`)}];`,
      ':if ([:len $tunnel] > 1) do={ :error "Tunnel terkelola ganda. Periksa sebelum melanjutkan."; };',
      `:if ([:len $tunnel] = 0) do={ :if ([:len [/interface find where name=${q(tunnelName)}]] > 0) do={ :error "Nama tunnel sudah digunakan konfigurasi lain."; }; /interface sstp-client add ${params} comment=${q(`${tag}:VPN`)}; } else={ /interface sstp-client set $tunnel ${params}; };`,
      '# IP VPN router harus statis sesuai nasname di web; server SSTP menetapkan remote-address.',
    );
  } else if (router.vpnHost) {
    lines.push('# Password VPN tidak disimpan di website. Tunnel yang sudah ada dipertahankan.', '# Untuk membuat/mengubah tunnel, isi ulang password VPN lalu simpan router di web.');
  }
  if (router.vpnHost) {
    const routeTag = q(`${tag}:RADIUS-ROUTE`);
    lines.push(
      `:if ([:len [/interface sstp-client find where name=${q(tunnelName)} and comment=${q(`${tag}:VPN`)}]] != 1) do={ :error "Tunnel terkelola belum ada. Isi ulang password VPN dan buat script lagi."; };`,
      '# Hanya IP server RADIUS dirutekan ke tunnel. Trafik internet pelanggan tidak dialihkan.',
      `:local route [/ip route find where comment=${routeTag}];`,
      ':if ([:len $route] > 1) do={ :error "Rute RADIUS terkelola ganda. Periksa manual."; };',
      `:if ([:len $route] = 0) do={ /ip route add dst-address=${q(`${serverIp}/32`)} gateway=${q(tunnelName)} comment=${routeTag}; } else={ /ip route set $route dst-address=${q(`${serverIp}/32`)} gateway=${q(tunnelName)} disabled=no; };`,
    );
  }
  const params = `address=${q(serverIp)} secret=${q(router.secret)} src-address=${q(sourceIp)} service=ppp authentication-port=${router.ports || 1812} accounting-port=1813 timeout=3s`;
  lines.push(
    `:local entry [/radius find where comment=${q(tag)}];`,
    ':if ([:len $entry] > 1) do={ :error "Entri RADIUS terkelola ganda. Periksa sebelum melanjutkan."; };',
    `:if ([:len $entry] = 0) do={ /radius add ${params} comment=${q(tag)}; } else={ /radius set $entry ${params} disabled=no; };`,
    '/ppp aaa set use-radius=yes accounting=yes interim-update=5m;',
    `/radius incoming set accept=yes port=${coaPort};`,
    `:local rule [/ip firewall filter find where comment=${q(`${tag}:COA`)}];`,
    ':if ([:len $rule] > 1) do={ :error "Rule Disconnect terkelola ganda. Periksa sebelum melanjutkan."; };',
    `:if ([:len $rule] = 0) do={ /ip firewall filter add chain=input protocol=udp src-address=${q(serverIp)} dst-port=${coaPort} action=accept comment=${q(`${tag}:COA`)}; } else={ /ip firewall filter set $rule chain=input protocol=udp src-address=${q(serverIp)} dst-port=${coaPort} action=accept disabled=no; };`,
    `:if ([:len [/ip firewall filter find]] > 1) do={ /ip firewall filter move [find where comment=${q(`${tag}:COA`)}] 0; };`,
    '# Tolak koneksi TCP baru dari IP server billing ke layanan administrasi router.',
    '# Balasan koneksi yang dimulai router (termasuk SSTP) tetap dapat lewat.',
    `:local management [/ip firewall filter find where comment=${q(`${tag}:MGMT-DENY`)}];`,
    ':if ([:len $management] > 1) do={ :error "Rule pembatasan administrasi ganda. Periksa manual."; };',
    `:if ([:len $management] = 0) do={ /ip firewall filter add chain=input protocol=tcp connection-state=new src-address=${q(serverIp)} action=drop comment=${q(`${tag}:MGMT-DENY`)}; } else={ /ip firewall filter set $management chain=input protocol=tcp connection-state=new src-address=${q(serverIp)} action=drop disabled=no; };`,
    `:if ([:len [/ip firewall filter find]] > 1) do={ /ip firewall filter move [find where comment=${q(`${tag}:MGMT-DENY`)}] 0; };`,
    '}',
    '# Batasi port Disconnect pada firewall ke IP server RADIUS di atas; audit rule accept lain.',
    '# Jalur server -> IP VPN NAS harus tersedia. Uji ping dua arah sebelum dial PPPoE.',
    '# /radius print ; /radius monitor [find where service=ppp] ; /ppp active print',
    '# Akun PPP lokal dengan username sama diprioritaskan; pakai akun uji tanpa secret lokal.',
    '# Script ini tidak memerlukan password admin/API dan tidak mengaktifkan hotspot/login RADIUS.',
  );
  return lines.join('\n');
}
