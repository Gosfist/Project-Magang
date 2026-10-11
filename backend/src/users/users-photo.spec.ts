import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { UsersService } from './users.service.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(), mkdir: vi.fn(), writeFile: vi.fn(), unlink: vi.fn(), realpath: vi.fn(),
}));

describe('admin user profile photos', () => {
  beforeEach(() => vi.mocked(readFile).mockReset());

  it.each([['jpg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']])('streams a stored %s photo with the proper MIME type', async (extension, type) => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ photo: `/uploads/profile/2.${extension}` }) } };
    const buffer = Buffer.from('image-test');
    vi.mocked(readFile).mockResolvedValue(buffer as never);
    const file = await new UsersService(prisma as any).photo('2');
    expect(file.getHeaders()).toMatchObject({ type, disposition: 'inline', length: buffer.length });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 2n }, select: { photo: true } });
    expect(readFile).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`[/\\\\]profile[/\\\\]2\\.${extension}$`)));
  });

  it.each([null, '/uploads/profile/../../secret.png', '/uploads/ktp/2.jpg', 'https://example.com/image.png'])('never reads an invalid photo reference: %s', async photo => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ photo }) } };
    await expect(new UsersService(prisma as any).photo('2')).rejects.toThrow('Foto profil belum tersedia');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('reports a missing user without reading files', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(new UsersService(prisma as any).photo('2')).rejects.toThrow('Petugas tidak ditemukan');
    expect(readFile).not.toHaveBeenCalled();
  });

  it('returns not found when the referenced image is missing', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ photo: '/uploads/profile/2.jpg' }) } };
    vi.mocked(readFile).mockRejectedValueOnce({ code: 'ENOENT' });
    await expect(new UsersService(prisma as any).photo('2')).rejects.toMatchObject({ message: 'File foto profil tidak ditemukan.', status: 404 });
  });
});
