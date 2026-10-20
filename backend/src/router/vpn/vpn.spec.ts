import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { VpnService } from './vpn.service.js';
import { SecretService } from '../../pppoe/shared/secret.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RoutersService } from '../routers/routers.service.js';
import { rootCertificates } from 'node:tls';
import { vpnCaCertificate } from '../shared/radius-setup-script.js';

function setup() {
  const config = new ConfigService({ VPN_SSTP_HOST: '192.0.2.8', JWT_SECRET: 'test-key-only' });
  const secrets = new SecretService(config);
  const client = { id: 3n, name: 'Cabang', username: 'vpn_cabang', vpnIp: '10.88.0.2', vpnType: 'sstp', isActive: true, provisionedAt: null, passwordEncrypted: secrets.encrypt('test-password-123'), routers: null };
  const vpnClient = { findMany: vi.fn(async () => [client]), findUnique: vi.fn(async () => client), create: vi.fn(async ({ data }) => ({ id: 4n, ...data })) };
  const nas = { findFirst: vi.fn(async () => null) };
  const prisma = { vpnClient, nas, $transaction: vi.fn(async fn => fn({ vpnClient })) };
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
    await expect(service.create('Cabang', 'vpn_cabang')).rejects.toThrow('setupvpnserver');
  });
  it('derives all NAS tunnel settings from the selected client and regenerates a complete SSTP script', async () => {
    const ca = vpnCaCertificate(rootCertificates.find(p => p.length < 3900)!);
    const forRouter = vi.fn(async () => ({ id: 3n, ip: '10.88.0.2', radiusIp: '10.88.0.1', host: '192.0.2.8', username: 'vpn_cabang', password: 'test-password-123', ca }));
    let saved: any;
    const prisma = { nas: { findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }) => (saved = { id: 7, ...data })), findUnique: vi.fn(async () => saved) } };
    const service = new RoutersService(prisma as any, { forRouter } as any);
    const response = await service.createRouter({ name: 'Cabang', nasname: '192.0.2.99', vpnClientId: '3' });
    expect(saved).toMatchObject({ vpnClientId: 3n, nasname: '10.88.0.2', ipAddress: '10.88.0.2', radiusServerIp: '10.88.0.1' });
    expect(saved).not.toHaveProperty('vpnPassword');
    const script = (await service.getRouterScript('7')).scriptRos7;
    expect(script).toBe(response.setup.scriptRos7);
    expect(script).toContain('port=4443');
    expect(script).toContain('password="test-password-123"');
    expect(script).toContain('/certificate import');
    expect(script).toContain('add-default-route=no');
  });
});
