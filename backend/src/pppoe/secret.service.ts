import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

@Injectable()
export class SecretService {
  constructor(private readonly config: ConfigService) { }

  encrypt(value: string) {
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `unzanet:v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(value: string) {
    if (value.startsWith('unzanet:v1:')) {
      const [, , iv, tag, encrypted] = value.split(':');
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
    }
    return this.decryptLaravel(value);
  }

  private decryptLaravel(value: string) {
    const appKey = this.config.get<string>('LARAVEL_APP_KEY');
    if (!appKey) throw new InternalServerErrorException('LARAVEL_APP_KEY wajib diisi untuk membaca kata sandi PPPoE lama.');
    try {
      const key = Buffer.from(appKey.replace(/^base64:/, ''), 'base64');
      const payload = JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as { iv: string; value: string; mac: string };
      const expected = createHmac('sha256', key).update(payload.iv + payload.value).digest();
      const actual = Buffer.from(payload.mac, 'hex');
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('MAC tidak valid');
      const decipher = createDecipheriv('aes-256-cbc', key, Buffer.from(payload.iv, 'base64'));
      const plain = Buffer.concat([decipher.update(Buffer.from(payload.value, 'base64')), decipher.final()]).toString('utf8');
      const serialized = plain.match(/^s:\d+:"([\s\S]*)";$/);
      return serialized?.[1] ?? plain;
    } catch {
      throw new InternalServerErrorException('Kata sandi PPPoE lama gagal didekripsi. Periksa LARAVEL_APP_KEY.');
    }
  }

  private key() {
    return createHash('sha256').update(this.config.get<string>('JWT_SECRET') ?? 'development-only-secret').digest();
  }
}
