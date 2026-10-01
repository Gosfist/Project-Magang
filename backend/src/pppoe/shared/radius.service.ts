import { Injectable } from '@nestjs/common';
import type { PppoeAccount, PppoePackage, Prisma } from '@prisma/client';
import { SecretService } from './secret.service.js';

@Injectable()
export class RadiusService {
  constructor(private readonly secrets: SecretService) { }

  async sync(tx: Prisma.TransactionClient, account: PppoeAccount & { package: PppoePackage & { ipPool?: any } }, oldUsername = account.username) {
    const usernames = [...new Set([oldUsername, account.username].filter(Boolean))];
    await tx.radcheck.deleteMany({ where: { username: { in: usernames } } });
    await tx.radreply.deleteMany({ where: { username: { in: usernames } } });
    if (!account.isActive || !account.package.isActive) return;

    const checks = [
      { username: account.username, attribute: 'Cleartext-Password', op: ':=', value: this.secrets.decrypt(account.password) },
      { username: account.username, attribute: 'Simultaneous-Use', op: ':=', value: '1' },
    ];
    const promise = await tx.paymentPromise.findFirst({ where: { pppoeAccountId: account.id, status: 'ACTIVE' }, orderBy: { id: 'desc' } });
    if (promise) {
      // FreeRADIUS date attributes accept Unix seconds, avoiding server timezone ambiguity.
      checks.push({ username: account.username, attribute: 'Expiration', op: ':=', value: String(Math.floor(promise.deadline.getTime() / 1000)) });
    } else if (account.expiresAt) {
      checks.push({ username: account.username, attribute: 'Expiration', op: ':=', value: this.expiration(account.expiresAt) });
    }
    await tx.radcheck.createMany({ data: checks });
    const replies = [{ username: account.username, attribute: 'Mikrotik-Rate-Limit', op: ':=', value: `${account.package.uploadMbps}M/${account.package.downloadMbps}M` }];

    const poolName = account.package.ipPool?.name || account.package.addressPool;
    if (poolName) replies.push({ username: account.username, attribute: 'Framed-Pool', op: ':=', value: poolName });

    await tx.radreply.createMany({ data: replies });
  }

  private expiration(date: Date) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()];
    return `${day} ${month} ${date.getUTCFullYear()} 23:59:59`;
  }
}
