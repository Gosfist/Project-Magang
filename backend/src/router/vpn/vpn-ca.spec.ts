import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rootCertificates } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { VpnService } from './vpn.service.js';
import { VpnController } from './vpn.controller.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe('Optional SSTP CA download', () => {
  const service = () => new VpnService({} as any, new ConfigService({}), {} as any);

  it('downloads only the public CA from the installer export, without server/account dependencies', async () => {
    const pem = rootCertificates[0];
    vi.mocked(readFile).mockResolvedValue(Buffer.from(pem + '\nPRIVATE MATERIAL MUST NOT BE EXPORTED'));
    const controller = new VpnController(service());
    const file = await controller.certificate();
    const chunks: Buffer[] = [];
    for await (const chunk of file.getStream()) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe(new X509Certificate(pem).toString());
    expect(readFile).toHaveBeenCalledExactlyOnceWith('/etc/unzanet-public/sstp-ca.crt');
    expect(file.getHeaders()).toMatchObject({ type: 'application/x-pem-file', disposition: 'attachment; filename="sstp-ca.crt"' });
    expect(Reflect.getMetadata('__guards__', VpnController)).toEqual([JwtAuthGuard, AdminGuard]);
    expect(Reflect.getMetadata('__headers__', VpnController.prototype.certificate)).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
  });

  it('reports missing, unreadable or invalid CA files without revealing filesystem errors', async () => {
    for (const code of ['ENOENT', 'EACCES']) {
      vi.mocked(readFile).mockRejectedValueOnce(new Error(code));
      await expect(service().certificate()).rejects.toThrow('CA VPN belum tersedia');
    }
    vi.mocked(readFile).mockResolvedValueOnce(Buffer.from('invalid certificate'));
    await expect(service().certificate()).rejects.toThrow('CA VPN belum tersedia');
  });
});
