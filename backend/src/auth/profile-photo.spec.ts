import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthService } from './auth.service.js';
import { uploadsDirectory } from '../common/image-storage.js';

vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  readFile: vi.fn(),
}));

describe('authenticated profile photo', () => {
  beforeEach(() => vi.resetAllMocks());
  function setup(photo: string | null, status = 'active') {
    const findUnique = vi.fn().mockResolvedValue({ photo, status });
    return { service: new AuthService({ user: { findUnique } } as any, {} as any), findUnique };
  }
  it.each([['jpg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']])('serves the saved %s file through the API', async (extension, type) => {
    const { service, findUnique } = setup(`/uploads/profile/7.${extension}`);
    vi.mocked(readFile).mockResolvedValue(Buffer.from('image'));
    const photo = await service.profilePhoto('7');
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 7n }, select: { photo: true, status: true } });
    expect(readFile).toHaveBeenCalledWith(join(uploadsDirectory(), 'profile', `7.${extension}`));
    expect(photo.getHeaders()).toMatchObject({ type, disposition: 'inline' });
  });
  it.each([null, '/uploads/profile/../../secret.jpg', '/uploads/ktp/7.jpg'])('rejects missing or unrelated reference %s', async reference => {
    const { service } = setup(reference);
    await expect(service.profilePhoto('7')).rejects.toThrow('Foto profil belum tersedia');
    expect(readFile).not.toHaveBeenCalled();
  });
  it('returns a not-found response for a missing file', async () => {
    const { service } = setup('/uploads/profile/7.jpg');
    vi.mocked(readFile).mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    await expect(service.profilePhoto('7')).rejects.toThrow('File foto profil tidak ditemukan');
  });
  it('rejects an inactive user before reading the photo', async () => {
    const { service } = setup('/uploads/profile/7.jpg', 'inactive');
    await expect(service.profilePhoto('7')).rejects.toThrow('Unauthorized');
    expect(readFile).not.toHaveBeenCalled();
  });
});
