import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';

export function zeroTierJoinScript(client: { id: bigint; networkId: string; deviceType: string }, serverIp: string, apiPort: number) {
  if (!/^[0-9a-f]{16}$/.test(client.networkId)) throw new BadRequestException('Network ID ZeroTier tidak valid.');
  if (client.deviceType !== 'mikrotik') {
    return [
      '# Ubuntu / Linux: pasang ZeroTier dari https://www.zerotier.com/download/ terlebih dahulu.',
      '# Jalankan di dalam VM Ubuntu, bukan hanya pada host Windows VirtualBox.',
      'sudo systemctl enable --now zerotier-one',
      `sudo zerotier-cli join ${client.networkId}`,
      `sudo zerotier-cli set ${client.networkId} allowDefault=0`,
      `sudo zerotier-cli set ${client.networkId} allowGlobal=0`,
      'sudo zerotier-cli info',
      'sudo zerotier-cli listnetworks',
      '# Authorize node di ZeroTier Central. Catat Node ID dan Managed IP ke form web.',
      '# Perangkat Windows/macOS/HP: join Network ID yang sama lewat aplikasi ZeroTier.',
    ].join('\n');
  }
  const name = `zt-unzanet-${client.id}`;
  const tag = `UNZANET-ZT:${client.id}`;
  const lines = [
    '# RouterOS 7 ARM/ARM64: paket zerotier sesuai versi RouterOS harus sudah terpasang.',
    '# Jalankan sekali lewat Terminal/WinBox lokal. Web tidak dapat menjangkau router sebelum join.',
    '{',
    ':if ([:len [/zerotier find where name="zt1"]] = 0) do={ :error "Instance zt1 tidak ditemukan. Periksa paket ZeroTier dan device-mode."; };',
    '/zerotier enable [find where name="zt1"];',
    `:local zt [/zerotier interface find where network="${client.networkId}"];`,
    ':if ([:len $zt] > 1) do={ :error "Network ZeroTier terpasang lebih dari sekali. Periksa interface."; };',
    ':if ([:len $zt] = 0) do={',
    `  :if ([:len [/interface find where name="${name}"]] > 0) do={ :error "Nama interface sudah digunakan. Tidak ditimpa."; };`,
    `  /zerotier interface add name="${name}" network="${client.networkId}" instance=zt1 allow-managed=yes allow-default=no allow-global=no comment="${tag}";`,
    `  :set zt [/zerotier interface find where network="${client.networkId}"];`,
    '};',
    '/zerotier interface set $zt disabled=no allow-managed=yes allow-default=no allow-global=no;',
    ':local ztName [/zerotier interface get $zt name];',
  ];
  if (serverIp) {
    if (isIP(serverIp) !== 4 || !Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
      throw new BadRequestException('IP server atau port API tidak valid.');
    }
    for (const [suffix, params] of [
      ['API', `protocol=tcp dst-port=${apiPort}`], ['COA', 'protocol=udp dst-port=3799'], ['PING', 'protocol=icmp'],
    ]) {
      lines.push(
        `:local rule${suffix} [/ip firewall filter find where comment="${tag}:${suffix}"];`,
        `:if ([:len $rule${suffix}] = 0) do={ /ip firewall filter add chain=input in-interface=$ztName src-address=${serverIp} ${params} action=accept comment="${tag}:${suffix}"; } else={ /ip firewall filter set $rule${suffix} chain=input in-interface=$ztName src-address=${serverIp} ${params} action=accept disabled=no; };`,
        `:if ([:len [/ip firewall filter find]] > 1) do={ /ip firewall filter move [find where comment="${tag}:${suffix}"] 0; };`,
      );
    }
  } else {
    lines.push('# Simpan IP ZeroTier Ubuntu RADIUS di web, lalu unduh ulang untuk membuat rule API/CoA khusus server.');
  }
  lines.push('}', '/zerotier interface print', '/ip address print',
    '# Authorize node di ZeroTier Central dan catat Managed IP + Node ID ke web.',
    '# Jika layanan API memiliki address whitelist, tambahkan IP ZeroTier Ubuntu /32 pada whitelist yang ada.',
    '# Sesudah join: pilih klien ini pada Router / NAS, lalu gunakan Skrip RADIUS pada halaman tersebut.');
  return lines.join('\n');
}
