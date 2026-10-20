import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { VpnService } from './vpn.service.js';
import { SecretService } from '../../pppoe/shared/secret.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RoutersService } from '../routers/routers.service.js';
import { UpdateVpnDto, VpnController } from './vpn.controller.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';

function setup() {
  const config = new ConfigService({ VPN_SSTP_HOST: '192.0.2.8', JWT_SECRET: 'test-key-only' });
  const secrets = new SecretService(config);
  const client = { id: 3n, name: 'Cabang', username: 'vpn_cabang', vpnIp: '10.88.0.2', vpnType: 'sstp', isActive: true, provisionedAt: null, passwordEncrypted: secrets.encrypt('test-password-123'), routers: null };
  const vpnClient = { findMany: vi.fn(async () => [client]), findUnique: vi.fn(async () => client), create: vi.fn(async ({ data }) => ({ id: 4n, ...data })),
    update: vi.fn(async ({ data }) => ({ ...client, ...data })), delete: vi.fn(async () => client) };
  const nas = { findFirst: vi.fn(async () => null), updateMany: vi.fn(async () => ({ count: 1 })) };
  const prisma = { vpnClient, nas, $transaction: vi.fn(async fn => fn({ vpnClient, nas })) };
  const service = new VpnService(prisma as unknown as PrismaService, config, secrets);
  return { config, secrets, client, vpnClient, prisma, service };
}

describe('VPS SSTP account provisioning', () => {
  it('allocates a unique IP, encrypts the generated password, and keeps passwords out of list/create responses', async () => {
    const { service, vpnClient, secrets } = setup();
    const response = await service.create('Cabang dua', 'vpn_cabang2');
    const data = vpnClient.create.mock.calls[0][0].data;
    expect(data.vpnIp).toBe('10.88.0.3');
    expect(data.passwordEncrypted).toMatch(/^unzanet:v1:/);
    expect(secrets.decrypt(data.passwordEncrypted)).toMatch(/^[a-f0-9]{36}$/);
    expect(response).not.toHaveProperty('password');
    const list = await service.list();
    expect(list.data[0]).not.toHaveProperty('passwordEncrypted');
    expect(list.data[0]).not.toHaveProperty('password');
    expect(await service.credentials('3')).toEqual({ password: 'test-password-123' });
  });
  it('rejects file injection, weak credentials, missing server setup, pending accounts and reused accounts', async () => {
    const { service, config, client, prisma } = setup();
    await expect(service.create('Cabang', 'vpn\nroot', 'test-password-123')).rejects.toThrow('username');
    await expect(service.create('Cabang', 'vpn_cabang', 'short')).rejects.toThrow('password');
    await expect(service.forRouter('3')).rejects.toThrow('belum siap');
    client.provisionedAt = new Date() as any;
    prisma.nas.findFirst.mockResolvedValueOnce({ id: 7 } as any);
    await expect(service.forRouter('3')).rejects.toThrow('router lain');
    config.set('VPN_SSTP_HOST', '');
    await expect(service.create('Cabang', 'vpn_cabang')).rejects.toThrow('npm run install');
  });
  it('derives all NAS tunnel settings from the selected client and regenerates a complete SSTP script', async () => {
    const forRouter = vi.fn(async () => ({ id: 3n, ip: '10.88.0.2', radiusIp: '10.88.0.1', host: '192.0.2.8', username: 'vpn_cabang', password: 'test-password-123' }));
    let saved: any;
    const prisma = { appSetting: { findUnique: vi.fn(async () => null) }, nas: { findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }) => (saved = { id: 7, ...data })), findUnique: vi.fn(async () => saved) } };
    const service = new RoutersService(prisma as any, { forRouter } as any);
    const response = await service.createRouter({ name: 'Cabang', nasname: '192.0.2.99', vpnClientId: '3' });
    expect(saved).toMatchObject({ vpnClientId: 3n, nasname: '10.88.0.2', ipAddress: '10.88.0.2', radiusServerIp: '10.88.0.1' });
    expect(saved).not.toHaveProperty('vpnPassword');
    const script = (await service.getRouterScript('7')).scriptRos7;
    expect(script).toBe(response.setup.scriptRos7);
    expect(script).toContain('port=4443');
    expect(script).toContain('password="test-password-123"');
    expect(script).not.toContain('/certificate');
    expect(script).toContain('verify-server-certificate=no');
    expect(script).toContain('add-default-route=no');
  });

  it('returns selected VPN credentials without depending on a CA file on disk', async () => {
    const { service, client } = setup();
    client.provisionedAt = new Date() as any;
    const result = await service.forRouter('3');
    expect(result).toMatchObject({ ip: '10.88.0.2', radiusIp: '10.88.0.1', host: '192.0.2.8', password: 'test-password-123' });
    expect(result).not.toHaveProperty('ca');
  });

  it('returns plaintext only for the explicit admin credentials list and never exposes encrypted fields', async () => {
    const { service } = setup();
    expect((await service.list()).data[0]).not.toHaveProperty('password');
    const item = (await service.list(true)).data[0];
    expect(item.password).toBe('test-password-123');
    expect(item).not.toHaveProperty('passwordEncrypted');
    expect(Reflect.getMetadata('__guards__', VpnController)).toEqual([JwtAuthGuard, AdminGuard]);
    for (const name of ['list', 'update', 'remove'] as const) {
      expect(Reflect.getMetadata('__headers__', VpnController.prototype[name])).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
    }
  });

  it('edits name, username and password, preserves VPN IP and synchronizes linked NAS metadata', async () => {
    const { service, vpnClient, prisma, secrets } = setup();
    const result = await service.update('3', ' Cabang baru ', 'vpn_baru', 'new-password-123');
    const data = vpnClient.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: 'Cabang baru', username: 'vpn_baru', provisionedAt: null });
    expect(secrets.decrypt(data.passwordEncrypted)).toBe('new-password-123');
    expect(data).not.toHaveProperty('password');
    expect(data).not.toHaveProperty('vpnIp');
    expect(prisma.nas.updateMany).toHaveBeenCalledWith({ where: { vpnClientId: 3n }, data: { vpnUsername: 'vpn_baru' } });
    expect(result.message).toContain('MikroTik');
  });

  it('keeps the original password and provisioning state for a name-only edit or unchanged password', async () => {
    for (const password of [undefined, 'test-password-123']) {
      const { service, vpnClient, prisma } = setup();
      await service.update('3', 'Nama baru', 'vpn_cabang', password);
      expect(vpnClient.update.mock.calls[0][0].data).toEqual({ name: 'Nama baru', username: 'vpn_cabang' });
      expect(prisma.nas.updateMany).not.toHaveBeenCalled();
    }
  });

  it('rejects unsafe credentials, invalid IDs and duplicate usernames without returning secrets', async () => {
    const { service, vpnClient } = setup();
    for (const [name, username, password] of [['', 'vpn_baru', undefined], ['Cabang', 'bad\nuser', undefined], ['Cabang', 'vpn_baru', 'short']]) {
      await expect(service.update('3', name!, username!, password)).rejects.toThrow();
    }
    for (const id of ['0', '-1', '18446744073709551616', '3;DROP']) {
      await expect(service.update(id, 'Cabang', 'vpn_baru')).rejects.toThrow('ID klien VPN');
      await expect(service.remove(id)).rejects.toThrow('ID klien VPN');
    }
    expect(vpnClient.update).not.toHaveBeenCalled();
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '6.12.0' });
    vpnClient.update.mockRejectedValueOnce(duplicate);
    await expect(service.update('3', 'Cabang', 'vpn_baru')).rejects.toThrow('Username sudah digunakan');
  });

  it('does not delete an account while it is linked to a NAS, and deletes an unlinked account', async () => {
    const { service, vpnClient, prisma } = setup();
    prisma.nas.findFirst.mockResolvedValueOnce({ id: 7 } as any);
    await expect(service.remove('3')).rejects.toThrow('masih dipakai');
    expect(vpnClient.delete).not.toHaveBeenCalled();
    await expect(service.remove('3')).resolves.toMatchObject({ message: expect.stringContaining('dihapus') });
    expect(vpnClient.delete).toHaveBeenCalledWith({ where: { id: 3n } });
    expect(prisma.$transaction.mock.calls.at(-1)?.[1]).toEqual({ isolationLevel: 'Serializable' });
  });

  it('rejects missing or legacy accounts on edit and deletion', async () => {
    for (const client of [null, { vpnType: 'legacy' }]) {
      const { service, vpnClient } = setup();
      vpnClient.findUnique.mockResolvedValue(client as any);
      await expect(service.update('3', 'Cabang', 'vpn_baru')).rejects.toThrow('tidak ditemukan');
      await expect(service.remove('3')).rejects.toThrow('tidak ditemukan');
      expect(vpnClient.update).not.toHaveBeenCalled();
      expect(vpnClient.delete).not.toHaveBeenCalled();
    }
  });

  it('validates editable fields through the inherited update DTO and strips IP overrides', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    const result = await pipe.transform({ name: 'Baru', username: 'vpn_baru', password: 'new-password-123', vpnIp: '10.88.0.99' }, { type: 'body', metatype: UpdateVpnDto });
    expect(result).toMatchObject({ name: 'Baru', username: 'vpn_baru', password: 'new-password-123' });
    expect(result).not.toHaveProperty('vpnIp');
    await expect(pipe.transform({ name: 'Baru', username: 'bad user' }, { type: 'body', metatype: UpdateVpnDto })).rejects.toThrow();
  });
});
