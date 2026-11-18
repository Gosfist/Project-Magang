import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

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
    throw new InternalServerErrorException('Format kata sandi tersimpan tidak didukung. Simpan ulang kata sandi melalui aplikasi.');
  }

  private key() {
    return createHash('sha256').update(this.config.get<string>('JWT_SECRET') ?? 'development-only-secret').digest();
  }
}
