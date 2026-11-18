import { ConfigService } from '@nestjs/config';
import { SecretService } from './secret.service.js';

describe('SecretService', () => {
  it('mengenkripsi password PPPoE dan dapat membacanya kembali', () => {
    const config = new ConfigService({ JWT_SECRET: 'rahasia-test-yang-cukup-panjang' });
    const service = new SecretService(config);
    const encrypted = service.encrypt('pppoe-rahasia');

    expect(encrypted).not.toContain('pppoe-rahasia');
    expect(service.decrypt(encrypted)).toBe('pppoe-rahasia');
    expect(service.encrypt('pppoe-rahasia')).not.toBe(encrypted);
  });

  it('menolak format tersimpan yang tidak didukung', () => {
    const service = new SecretService(new ConfigService({ JWT_SECRET: 'secret-test' }));
    expect(() => service.decrypt('password-format-lama')).toThrow('Format kata sandi tersimpan tidak didukung');
  });

  it('menolak ciphertext yang diubah atau dibaca dengan kunci berbeda', () => {
    const service = new SecretService(new ConfigService({ JWT_SECRET: 'secret-test' }));
    const encrypted = service.encrypt('pppoe-rahasia');
    const parts = encrypted.split(':');
    const tag = Buffer.from(parts[3], 'base64');
    tag[0] ^= 1;
    parts[3] = tag.toString('base64');

    expect(() => service.decrypt(parts.join(':'))).toThrow();
    const otherService = new SecretService(new ConfigService({ JWT_SECRET: 'secret-lain' }));
    expect(() => otherService.decrypt(encrypted)).toThrow();
  });
});
