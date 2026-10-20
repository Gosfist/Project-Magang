import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { isIPv4 } from 'node:net';

type Snapshot = { checkedAt: string; available: boolean; sessions: { username: string; ip: string }[] };
type RouterVpn = { vpnClientId?: bigint | null; vpnHost: string | null; vpnUsername: string | null; nasname: string };
const MAX_AGE_MS = 45_000;

@Injectable()
export class VpnStatusService {
  async snapshot(): Promise<Snapshot | null> {
    try {
      const value = JSON.parse(await readFile('/run/unzanet-vpn-status/sessions.json', 'utf8'));
      if (typeof value.checkedAt !== 'string' || !Number.isFinite(Date.parse(value.checkedAt))
        || typeof value.available !== 'boolean' || !Array.isArray(value.sessions)
        || value.sessions.some((s: any) => !s || typeof s.username !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(s.username) || typeof s.ip !== 'string' || !isIPv4(s.ip))) return null;
      return value;
    } catch { return null; }
  }

  forRouter(router: RouterVpn, snapshot: Snapshot | null, now = Date.now()) {
    if (!router.vpnClientId && !router.vpnHost) return { vpnStatus: 'not_configured' as const, vpnCheckedAt: null };
    const age = snapshot ? now - Date.parse(snapshot.checkedAt) : NaN;
    const checkedAt = snapshot?.checkedAt ?? null;
    // Only local managed SSTP accounts are observed by this VPS's worker.
    if (!router.vpnClientId || !router.vpnUsername || !snapshot?.available || !Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      return { vpnStatus: 'unknown' as const, vpnCheckedAt: checkedAt };
    }
    const online = snapshot.sessions.some(s => s.username === router.vpnUsername && s.ip === router.nasname);
    return { vpnStatus: online ? 'online' as const : 'offline' as const, vpnCheckedAt: checkedAt };
  }
}
