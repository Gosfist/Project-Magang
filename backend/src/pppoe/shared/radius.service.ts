import { Injectable } from '@nestjs/common';
import type { PppoeAccount, PppoePackage, Prisma } from '@prisma/client';
import { SecretService } from './secret.service.js';
import { readIsolation, isolatedService } from './isolation-config.js';
import { internetPoolName, internetProfile, readNasNetwork } from '../../router/shared/nas-network.js';

@Injectable()
export class RadiusService {
  constructor(private readonly secrets: SecretService) { }

  async sync(tx: Prisma.TransactionClient, account: PppoeAccount & { package: PppoePackage & { ipPool?: any } }, oldUsername = account.username) {
    const usernames = [...new Set([oldUsername, account.username].filter(Boolean))];
    await tx.radcheck.deleteMany({ where: { username: { in: usernames } } });
    await tx.radreply.deleteMany({ where: { username: { in: usernames } } });
    const config = await readIsolation(tx, account.routerNasId);
    const network = await readNasNetwork(tx, account.routerNasId);
    const promise = await tx.paymentPromise.findFirst({ where: { pppoeAccountId: account.id, status: 'ACTIVE' }, orderBy: { id: 'desc' } });
    const isolated = isolatedService(account, promise);
    if ((!account.isActive || !account.package.isActive) && !config.enabled) return { isolationEnabled: false, isolated: true };

    const checks = [
      { username: account.username, attribute: 'Cleartext-Password', op: ':=', value: this.secrets.decrypt(account.password) },
      { username: account.username, attribute: 'Simultaneous-Use', op: ':=', value: '1' },
    ];
    if (!config.enabled && promise) {
      // FreeRADIUS date attributes accept Unix seconds, avoiding server timezone ambiguity.
      checks.push({ username: account.username, attribute: 'Expiration', op: ':=', value: String(Math.floor(promise.deadline.getTime() / 1000)) });
    } else if (!config.enabled && account.expiresAt) {
      checks.push({ username: account.username, attribute: 'Expiration', op: ':=', value: this.expiration(account.expiresAt) });
    }
    await tx.radcheck.createMany({ data: checks });
    const replies = [{ username: account.username, attribute: 'Mikrotik-Rate-Limit', op: ':=', value: `${account.package.uploadMbps}M/${account.package.downloadMbps}M` }];

    const poolName = config.enabled && isolated ? config.poolName : network ? internetPoolName : account.package.ipPool?.name || account.package.addressPool;
    if (poolName) replies.push({ username: account.username, attribute: 'Framed-Pool', op: ':=', value: poolName });
    if (config.enabled && isolated) replies.push({ username: account.username, attribute: 'Mikrotik-Group', op: ':=', value: config.profileName });
    else if (network) replies.push({ username: account.username, attribute: 'Mikrotik-Group', op: ':=', value: internetProfile(account.routerNasId!) });

    await tx.radreply.createMany({ data: replies });
    return { isolationEnabled: config.enabled, isolated };
  }

  private expiration(date: Date) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
    return `${day} ${month} ${date.getUTCFullYear()} 23:59:59`;
  }
}
