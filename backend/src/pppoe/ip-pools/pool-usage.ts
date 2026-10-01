import { isIPv4 } from 'node:net';

export function poolUsage(ranges: string, addresses: string[] | null) {
  const numeric = (ip: string) => ip.split('.').reduce((n, octet) => n * 256 + Number(octet), 0);
  const intervals: [number, number][] = [];
  for (const part of ranges.split(',')) {
    const token = part.trim();
    const pair = token.split('-').map((ip) => ip.trim());
    if (pair.length <= 2 && pair.every(isIPv4)) {
      const start = numeric(pair[0]);
      const end = numeric(pair[1] || pair[0]);
      if (start > end) return { totalIps: null, usedIps: null, freeIps: null };
      intervals.push([start, end]);
    } else {
      return { totalIps: null, usedIps: null, freeIps: null };
    }
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1] + 1) last[1] = Math.max(last[1], interval[1]);
    else merged.push([...interval]);
  }
  const totalIps = merged.reduce((sum, [start, end]) => sum + end - start + 1, 0);
  if (addresses === null) return { totalIps, usedIps: null, freeIps: null };
  const usedIps = new Set(addresses.filter((ip) => isIPv4(ip) && merged.some(([start, end]) => {
    const value = numeric(ip);
    return value >= start && value <= end;
  }))).size;
  return { totalIps, usedIps, freeIps: totalIps - usedIps };
}
