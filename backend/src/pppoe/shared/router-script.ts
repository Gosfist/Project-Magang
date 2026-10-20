// RouterOS scripts are downloads for an administrator to paste, never executed by the app.
export function rosQuote(value: string): string {
  let result = '"';
  for (const byte of Buffer.from(value, 'utf8')) {
    if ([34, 36, 92].includes(byte)) result += '\\' + String.fromCharCode(byte);
    else if (byte < 32 || byte > 126) result += '\\' + byte.toString(16).toUpperCase().padStart(2, '0');
    else result += String.fromCharCode(byte);
  }
  return result + '"';
}
type PoolPlan = { id: bigint; routerNasId: number | null; name: string; networkStart: string; networkEnd: string };

export function poolScript(pool: PoolPlan, oldName?: string) {
  const tag = rosQuote(`UNZANET-POOL:${pool.routerNasId}:${pool.id}`);
  const values = `name=${rosQuote(pool.name)} ranges=${rosQuote(`${pool.networkStart}-${pool.networkEnd}`)}`;
  return oldName === undefined
    ? `/ip pool add ${values} comment=${tag};`
    : `/ip pool set [find where name=${rosQuote(oldName)} and comment=${tag}] ${values} next-pool=none;`;
}

// Isolation setup can be installed after the pool already exists on the router.
export function ensurePoolScript(pool: PoolPlan, oldName = pool.name) {
  const tag = `UNZANET-POOL:${pool.routerNasId}:${pool.id}`;
  const name = rosQuote(pool.name), old = rosQuote(oldName), ranges = rosQuote(`${pool.networkStart}-${pool.networkEnd}`);
  return [
    `# NAS ${pool.routerNasId} - periksa router tujuan sebelum menempel script.`,
    '# Database hanya menyimpan rencana; pemakaian IP router tidak dipantau.',
    '{',
    `:local item [/ip pool find where name=${old}];`,
    ':if ([:len $item] > 1) do={ :error "Nama pool ganda"; };',
    ...(oldName !== pool.name ? [`:if ([:len [/ip pool find where name=${name}]] > 0) do={ :error "Nama pool tujuan sudah ada"; };`] : []),
    `:if ([:len $item] = 0) do={ /ip pool add name=${name} ranges=${ranges} comment=${rosQuote(tag)}; } else={`,
    `  :if ([/ip pool get $item comment] = ${rosQuote(tag)}) do={ /ip pool set $item name=${name} ranges=${ranges} next-pool=none; } else={`,
    `    :if (([/ip pool get $item name] != ${name}) || ([/ip pool get $item ranges] != ${ranges}) || ([/ip pool get $item next-pool] != "none")) do={ :error "Pool nonkelola berbeda. Periksa manual; tidak ditimpa."; };`,
    '    :put "Pool yang sudah ada sesuai; konfigurasi tidak diubah.";',
    '  };',
    '};',
    '}',
  ].join('\n');
}
