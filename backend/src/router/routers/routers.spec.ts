import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MikrotikService } from '../shared/mikrotik.service.js';
import { RoutersService } from './routers.service.js';

describe('Router / NAS without the VPN client registry', () => {
  afterEach(() => vi.unstubAllEnvs());

  const router = {
    id: 7, name: 'Router cabang', nasname: '10.88.0.3', ipAddress: '10.88.0.3',
    secret: 'test-only-secret', ports: 1812, port: 8728, password: 'test-only-password',
    type: 'mikrotik', isActive: true, vpnClientId: 99n,
  };

  it('creates and edits NAS addresses without querying or changing VPN records', async () => {
    const nas = {
      create: vi.fn(async ({ data }) => ({ id: 7, ...data })),
      findUnique: vi.fn(async () => router),
      update: vi.fn(async ({ data }) => ({ ...router, ...data })),
    };
    const service = new RoutersService({ nas } as unknown as PrismaService, {} as MikrotikService);
    const dto = {
      name: 'Router cabang', nasname: ' 10.88.0.3 ', ipAddress: ' 10.88.0.4 ',
      secret: 'test-only-secret',
    };
    await service.createRouter(dto);
    await service.updateRouter('7', dto);
    for (const call of [nas.create.mock.calls[0][0], nas.update.mock.calls[0][0]]) {
      expect(call.data).toMatchObject({ nasname: '10.88.0.3', ipAddress: '10.88.0.4', authMode: 'radius' });
      expect(call.data).not.toHaveProperty('vpnClientId');
    }
    expect(nas.update.mock.calls[0][0].data.password).toBe(router.password);
  });

  it('generates both RADIUS scripts using the configured server and saved NAS IP, including legacy linked routers', async () => {
    vi.stubEnv('RADIUS_SERVER_IP', '10.88.0.2');
    const nas = { findUnique: vi.fn(async () => router) };
    const service = new RoutersService({ nas } as unknown as PrismaService, {} as MikrotikService);
    const result = await service.getRouterScript('7');
    expect(result).toMatchObject({ radiusServerIp: '10.88.0.2', nasSrcAddress: '10.88.0.3' });
    for (const script of [result.scriptRos6, result.scriptRos7]) {
      expect(script).toContain('address="10.88.0.2"');
      expect(script).toContain('src-address="10.88.0.3"');
      expect(script).toContain('/ppp aaa set use-radius=yes accounting=yes');
    }
    expect(nas.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
  });
});
