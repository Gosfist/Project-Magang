import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { removeCustomerImage } from './image-storage.js';

describe('customer photo deletion', () => {
  let root: string | undefined;
  const original = process.env.UPLOADS_DIR;
  afterEach(async () => {
    if (original === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = original;
    if (root) {
      expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
      expect(basename(root).startsWith('unzanet-photo-test-')).toBe(true);
      await rm(root, { recursive: true, force: true });
    }
    root = undefined;
  });
  it('deletes the referenced installation photo without touching payment evidence', async () => {
    root = await mkdtemp(join(tmpdir(), 'unzanet-photo-test-'));
    process.env.UPLOADS_DIR = root;
    await mkdir(join(root, 'instalasi'));
    await mkdir(join(root, 'bukti-setoran'));
    await writeFile(join(root, 'instalasi', '1.jpg'), 'test');
    await writeFile(join(root, 'bukti-setoran', '1.jpg'), 'receipt');
    await removeCustomerImage('/uploads/instalasi/1.jpg');
    await expect(access(join(root, 'instalasi', '1.jpg'))).rejects.toThrow();
    await expect(access(join(root, 'bukti-setoran', '1.jpg'))).resolves.toBeUndefined();
    await expect(removeCustomerImage('/uploads/instalasi/1.jpg')).resolves.toBeUndefined();
  });
  it.each(['/uploads/ktp/../../secret.jpg', '/uploads/bukti-setoran/1.jpg', '/uploads/profile/1.jpg', 'C:/secret.jpg'])('rejects invalid or unrelated path %s', async path => {
    await expect(removeCustomerImage(path)).rejects.toThrow('Referensi foto');
  });
});
