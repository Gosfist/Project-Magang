import { ConfigService } from '@nestjs/config';
import { SecretService } from './secret.service.js';

describe('SecretService', () => {
  it('mengenkripsi password PPPoE dan dapat membacanya kembali', () => {
    const config = new ConfigService({ JWT_SECRET: 'rahasia-test-yang-cukup-panjang' });
    const service = new SecretService(config);
    const encrypted = service.encrypt('pppoe-rahasia');

    expect(encrypted).not.toContain('pppoe-rahasia');
    expect(service.decrypt(encrypted)).toBe('pppoe-rahasia');
  });
});
