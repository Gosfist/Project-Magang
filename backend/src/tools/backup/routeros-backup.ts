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

export function radiusScript(routerId: number) {
  const prefix = backupPrefix(routerId);
  return [
    '# UNZANET - KEMBALI KE RADIUS',
    `# Router/NAS ID ${routerId}. Jalankan setelah RADIUS telah diuji normal.`,
    '# Menghapus seluruh konfigurasi khusus backup: secrets, profil dan firewall cadangan.',
    '# Sesi akun backup disambungkan ulang sekali agar memakai RADIUS dan melepas queue dinamis lokal.',
    '# Profil asli, pool dan konfigurasi isolir utama tetap ada. Profil yang masih direferensikan dilewati.',
    '{',
    '/ppp aaa set use-radius=yes;',
    `:foreach item in=[/ppp secret find where comment~${q('^' + prefix + 'ACCOUNT:')}] do={`,
    '  :if ([/ppp secret get $item service] = "pppoe") do={',
    '    :local user [/ppp secret get $item name];',
    '    /ppp secret remove $item;',
    '    /ppp active remove [/ppp active find where name=$user and service="pppoe"];',
    '  };',
    '};',
    ':local removedProfiles 0;',
    ':local keptProfiles 0;',
    // Both the generated name and exact ownership tag must match. This also
    // finds obsolete profiles after an earlier return script removed secrets.
    `:foreach backupProfile in=[/ppp profile find where comment~${q('^' + prefix + 'PROFILE:')} and name~${q(`^UNZANET-BACKUP-${routerId}-(PKG|ISOLIR)-`)}] do={`,
    '  :local backupProfileName [/ppp profile get $backupProfile name];',
    `  :if ([/ppp profile get $backupProfile comment] = (${q(prefix + 'PROFILE:')} . $backupProfileName)) do={`,
    '    :if (([:len [/ppp secret find where profile=$backupProfileName]] > 0) || ([:len [/interface pppoe-server server find where default-profile=$backupProfileName]] > 0)) do={',
    '      :set keptProfiles ($keptProfiles + 1);',
    '      :put ("Profil cadangan dilewati karena masih direferensikan: " . $backupProfileName);',
    '    } else={',
    '      :do {',
    '        /ppp profile remove $backupProfile;',
    '        :set removedProfiles ($removedProfiles + 1);',
    '      } on-error={',
    '        :set keptProfiles ($keptProfiles + 1);',
    '        :put ("Profil cadangan belum dapat dihapus oleh router: " . $backupProfileName);',
    '      };',
    '    };',
    '  };',
    '};',
    ':local removedRules 0;',
    ':local keptRules 0;',
    // Never remove the shared UNZANET-ISOLIR rules used by live RADIUS.
    ...['ROUTER', 'IN', 'OUT'].flatMap(suffix => [
      `:foreach backupRule in=[/ip firewall filter find where comment=${q(prefix + 'FIREWALL:' + suffix)}] do={`,
      '  :if ($keptProfiles > 0) do={',
      '    :set keptRules ($keptRules + 1);',
      '    :put "Firewall cadangan belum dihapus karena masih ada profil cadangan yang belum bersih.";',
      '  } else={',
      '    :do {',
      '      /ip firewall filter remove $backupRule;',
      '      :set removedRules ($removedRules + 1);',
      '    } on-error={',
      '      :set keptRules ($keptRules + 1);',
      '      :put "Firewall cadangan belum dapat dihapus oleh router.";',
      '    };',
      '  };',
      '};',
    ]),
    ':put "Secrets cadangan dihapus. Sesi terkait disambungkan ulang ke RADIUS.";',
    ':put ("Profil cadangan dihapus: " . $removedProfiles . "; dilewati: " . $keptProfiles . ".");',
    ':put ("Firewall cadangan dihapus: " . $removedRules . "; dilewati: " . $keptRules . ".");',
    ':if (($keptProfiles = 0) && ($keptRules = 0)) do={ :put "Pembersihan konfigurasi backup selesai."; } else={ :put "Pembersihan backup belum lengkap. Periksa pesan di atas, perbaiki referensi/penyebabnya lalu jalankan ulang script."; };',
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
    // Backup-only rules have separate ownership. Do not replace or modify the
    // shared isolation rules that RADIUS still needs after this backup is gone.
    for (const spec of [
      ['input', 'src-address', 'ROUTER'], ['forward', 'dst-address', 'IN'], ['forward', 'src-address', 'OUT'],
    ]) {
      const comment = `${prefix}FIREWALL:${spec[2]}`;
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
