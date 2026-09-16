import { BadRequestException, NotFoundException, StreamableFile } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const ID_CARD_MAX_BYTES = 5 * 1024 * 1024;
const directory = () => join(process.cwd(), 'storage', 'id-cards');
const referencePattern = /^id-cards\/[a-f0-9-]{36}\.(jpg|png|webp)$/;

export function imageExtension(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  throw new BadRequestException('Foto KTP harus berupa gambar JPG, PNG, atau WebP.');
}

export async function storeIdCardPhoto(file?: { buffer: Buffer }) {
  if (!file?.buffer?.length) throw new BadRequestException('Pilih foto KTP untuk diunggah.');
  if (file.buffer.length > ID_CARD_MAX_BYTES) throw new BadRequestException('Ukuran foto KTP maksimal 5 MB.');
  const extension = imageExtension(file.buffer);
  const filename = `${randomUUID()}.${extension}`;
  await mkdir(directory(), { recursive: true });
  await writeFile(join(directory(), filename), file.buffer, { flag: 'wx', mode: 0o600 });
  return { path: `id-cards/${filename}` };
}

export async function validateIdCardPhoto(reference: string) {
  if (!referencePattern.test(reference)) throw new BadRequestException('Unggah foto KTP melalui pilihan gambar.');
  try { await access(join(directory(), reference.slice('id-cards/'.length))); }
  catch { throw new BadRequestException('Foto KTP tidak ditemukan. Unggah kembali gambar.'); }
}

export async function readIdCardPhoto(filename: string) {
  if (!referencePattern.test(`id-cards/${filename}`)) throw new NotFoundException('Foto KTP tidak ditemukan.');
  let buffer: Buffer;
  try { buffer = await readFile(join(directory(), filename)); }
  catch { throw new NotFoundException('Foto KTP tidak ditemukan.'); }
  const type = filename.endsWith('.jpg') ? 'image/jpeg' : filename.endsWith('.png') ? 'image/png' : 'image/webp';
  return new StreamableFile(buffer, { type, disposition: 'inline' });
}
