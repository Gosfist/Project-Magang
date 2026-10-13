import { BadRequestException } from '@nestjs/common';
import type { IsolationConfig } from '../../pppoe/shared/isolation-config.js';

export const backupPrefix = (routerId: number) => `UNZANET-BACKUP:${routerId}:`;
export type LocalAccount = { customerNumber: string; username: string; password: string; pool: string; rate: string; packageId: string; isolated: boolean };
export type LocalSettings = { localAddress: string; baseProfile: string };

/** RouterOS strings interpolate dollars and require byte escapes for non-ASCII. */
export function rosString(value: string) {
  let text = '"';
  for (const byte of Buffer.from(value, 'utf8')) {
    if (byte === 34 || byte === 36 || byte === 92) text += '\\' + String.fromCharCode(byte);
    else if (byte < 32 || byte > 126) text += '\\' + byte.toString(16).toUpperCase().padStart(2, '0');
    else text += String.fromCharCode(byte);
  }
  return text + '"';
}
const q = rosString;
const profileName = (router: number, pkg: string, isolated: boolean) => `UNZANET-BACKUP-${router}-${isolated ? 'ISOLIR-' : 'PKG-'}${pkg}`;

function ownership(path: string, name: string, tag: string) {
  return `:foreach item in=[${path} find where name=${q(name)}] do={ :if ([${path} get $item comment] != ${q(tag)}) do={ :error ${q(`Nama ${name} sudah dipakai konfigurasi lain. Tidak ditimpa.`)}; }; };`;
}

export function radiusScript(routerId: number, reconnect: boolean) {
  const prefix = `^${backupPrefix(routerId)}ACCOUNT:`;
  return [
    '# UNZANET - KEMBALI KE RADIUS',
    `# Router/NAS ID ${routerId}. Jalankan setelah RADIUS telah diuji normal.`,
    '# Hanya menonaktifkan secrets PPPoE cadangan milik aplikasi; tidak menghapus akun.',
    '{',
    '/ppp aaa set use-radius=yes;',
    `:foreach item in=[/ppp secret find where comment~${q(prefix)}] do={`,
    '  :if ([/ppp secret get $item service] = "pppoe") do={',
    '    :local user [/ppp secret get $item name];',
    '    /ppp secret set $item disabled=yes;',
    ...(reconnect ? ['    /ppp active remove [/ppp active find where name=$user and service="pppoe"];'] : []),
    '  };',
    '};',
    `:put ${q(reconnect ? 'Secrets cadangan nonaktif. Sesi terkait disambungkan ulang ke RADIUS.' : 'Secrets cadangan nonaktif. Sesi aktif beralih ke RADIUS pada login berikutnya.')};`,
    '}', '',
  ].join('\r\n');
}

export function localScript(routerId: number, accounts: LocalAccount[], settings: LocalSettings, isolation: IsolationConfig, reconnect: boolean) {
  if (!accounts.length) throw new BadRequestException('Tidak ada akun PPPoE yang ditugaskan ke router ini.');
  const prefix = backupPrefix(routerId);
  const profiles = new Map<string, { pool: string; rate: string; isolated: boolean }>();
  for (const account of accounts) {
    if (!account.pool) throw new BadRequestException(`Akun ${account.username}: IP Pool Harga Paket belum diatur.`);
    profiles.set(profileName(routerId, account.packageId, account.isolated && isolation.enabled), { pool: account.isolated && isolation.enabled ? isolation.poolName : account.pool, rate: account.rate, isolated: account.isolated && isolation.enabled });
  }
  const lines = [
    '# UNZANET - PPPoE LOKAL DARURAT (MENGANDUNG PASSWORD)',
    `# Router/NAS ID ${routerId}; dibuat ${new Date().toISOString()}; ${accounts.length} akun.`,
    '# Simpan sebelum gangguan. Paste seluruh isi termasuk kurung pembuka/penutup.',
    '# Pool dan profil dasar harus sudah tersedia pada router. Script berhenti jika nama bentrok.',
    '# Status akun adalah snapshot saat diunduh; pembaruan billing web tidak berjalan dalam mode lokal.',
    '{',
    `:if ([:len [/ppp profile find where name=${q(settings.baseProfile)}]] = 0) do={ :error "Profil dasar PPPoE tidak ditemukan."; };`,
  ];
  // Complete preflight before any mutation, including conflicts in the final row.
  for (const pool of new Set([...profiles.values()].map(profile => profile.pool))) lines.push(`:if ([:len [/ip pool find where name=${q(pool)}]] = 0) do={ :error ${q(`IP Pool ${pool} tidak ditemukan pada router ini.`)}; };`);
  for (const [name] of profiles) lines.push(ownership('/ppp profile', name, prefix + 'PROFILE:' + name));
  for (const account of accounts) lines.push(ownership('/ppp secret', account.username, prefix + 'ACCOUNT:' + account.customerNumber));
  if (isolation.enabled) {
    // Replace managed rules only after placing the new canonical drop at the top.
    for (const spec of [
      ['input', 'src-address', 'ROUTER'], ['forward', 'dst-address', 'IN'], ['forward', 'src-address', 'OUT'],
    ]) {
      const comment = `UNZANET-ISOLIR:${routerId}:${spec[2]}`;
      lines.push(`{ :local old [/ip firewall filter find where comment=${q(comment)}]; :local added [/ip firewall filter add chain=${spec[0]} action=drop ${spec[1]}=${q(isolation.subnet)} disabled=no comment=${q(comment)}]; :local first [:pick [/ip firewall filter find where dynamic=no] 0]; :if ($first != $added) do={ /ip firewall filter move $added destination=$first; }; /ip firewall filter remove $old; };`);
    }
  }
  for (const [name, profile] of profiles) {
    const tag = prefix + 'PROFILE:' + name;
    const props = `local-address=${q(profile.isolated ? isolation.localAddress : settings.localAddress)} remote-address=${q(profile.pool)} rate-limit=${q(profile.rate)} only-one=yes change-tcp-mss=yes session-timeout=0s idle-timeout=0s comment=${q(tag)}${profile.isolated ? ' use-ipv6=no' : ''}`;
    lines.push(`:if ([:len [/ppp profile find where name=${q(name)}]] = 0) do={ /ppp profile add copy-from=${q(settings.baseProfile)} name=${q(name)} ${props}; } else={ /ppp profile set [/ppp profile find where name=${q(name)}] ${props}; };`);
  }
  lines.push(`/ppp secret set [/ppp secret find where comment~${q('^' + prefix + 'ACCOUNT:')}] disabled=yes;`);
  for (const account of accounts) {
    const tag = prefix + 'ACCOUNT:' + account.customerNumber;
    const props = `password=${q(account.password)} service=pppoe profile=${q(profileName(routerId, account.packageId, account.isolated && isolation.enabled))} disabled=${account.isolated && !isolation.enabled ? 'yes' : 'no'} comment=${q(tag)} local-address=0.0.0.0 remote-address=0.0.0.0 caller-id="" routes="" limit-bytes-in=0 limit-bytes-out=0`;
    lines.push(`:if ([:len [/ppp secret find where name=${q(account.username)}]] = 0) do={ /ppp secret add name=${q(account.username)} ${props}; } else={ /ppp secret set [/ppp secret find where name=${q(account.username)}] ${props}; };`);
    if (reconnect) lines.push(`/ppp active remove [/ppp active find where name=${q(account.username)} and service="pppoe"];`);
  }
  lines.push(`:put ${q(`Cadangan lokal diterapkan: ${accounts.length} akun. RADIUS global tidak diubah; secrets lokal aktif diprioritaskan.`)};`, '}', '');
  return lines.join('\r\n');
}
