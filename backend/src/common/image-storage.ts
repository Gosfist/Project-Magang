import { BadRequestException } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const maxBytes = 5 * 1024 * 1024;
const uploadsRoot = () => resolve(process.env.UPLOADS_DIR || join(process.cwd(), '..', 'uploads'));

function decodeImage(value: string): { buffer: Buffer; extension: string } {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(value);
  if (!match) throw new BadRequestException('Foto harus berupa JPG, PNG, atau WebP.');
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length || buffer.length > maxBytes) throw new BadRequestException('Ukuran foto maksimal 5 MB.');
  return { buffer, extension: match[1] === 'jpeg' ? 'jpg' : match[1] };
}

export async function storeImage(value: string | null | undefined, category: 'ktp' | 'profile' | 'instalasi' | 'bukti-setoran', name: string): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith('data:image/')) return value;
  const { buffer, extension } = decodeImage(value);
  const safeName = name.replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeName) throw new BadRequestException('Nama file foto tidak valid.');
  const relative = `/uploads/${category}/${safeName}.${extension}`;
  const target = join(uploadsRoot(), category, `${safeName}.${extension}`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, buffer, { mode: 0o640 });
  return relative;
}

export function uploadsDirectory() { return uploadsRoot(); }
