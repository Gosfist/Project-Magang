import { NotFoundException, StreamableFile } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { uploadsDirectory } from '../common/image-storage.js';

export async function readInstallationPhoto(reference: string | null | undefined) {
  const match = /^\/uploads\/instalasi\/(\d+)\.(jpg|png|webp)$/.exec(reference || '');
  if (!match) throw new NotFoundException('Foto instalasi belum tersedia.');

  let buffer: Buffer;
  try {
    buffer = await readFile(join(uploadsDirectory(), 'instalasi', `${match[1]}.${match[2]}`));
  } catch {
    throw new NotFoundException('File foto instalasi tidak ditemukan.');
  }

  const type = match[2] === 'jpg' ? 'image/jpeg' : `image/${match[2]}`;
  return new StreamableFile(buffer, { type, disposition: 'inline' });
}
