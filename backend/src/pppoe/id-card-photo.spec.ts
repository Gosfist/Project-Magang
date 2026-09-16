import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PppoeController } from './pppoe.controller.js';
import { PppoeService } from './pppoe.service.js';
import { ID_CARD_MAX_BYTES, validateIdCardPhoto } from './id-card-photo.js';

describe('KTP upload', () => {
  let app: INestApplication;
  let directory: string;
  let allowed = true;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'unzanet-upload-test-'));
    const module = await Test.createTestingModule({ controllers: [PppoeController], providers: [{ provide: PppoeService, useValue: {} }] })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => allowed }).compile();
    app = module.createNestApplication();
    await app.init();
    vi.spyOn(process, 'cwd').mockReturnValue(directory);
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
    await rm(directory, { recursive: true, force: true });
  });
  it('stores uploaded images privately and returns a valid reference', async () => {
    const response = await request(app.getHttpServer()).post('/pppoe/id-card-photo').attach('file', png, 'ktp.png').expect(201);
    expect(response.body.path).toMatch(/^id-cards\/[a-f0-9-]+\.png$/);
    await expect(validateIdCardPhoto(response.body.path)).resolves.toBeUndefined();
    expect(await readFile(join(directory, 'storage', response.body.path))).toEqual(png);
  });
  it('rejects non-images even when named .jpg', async () => {
    await request(app.getHttpServer()).post('/pppoe/id-card-photo').attach('file', Buffer.from('<script>alert(1)</script>'), 'ktp.jpg').expect(400);
  });
  it('rejects missing and oversized files', async () => {
    await request(app.getHttpServer()).post('/pppoe/id-card-photo').expect(400);
    await request(app.getHttpServer()).post('/pppoe/id-card-photo').attach('file', Buffer.alloc(ID_CARD_MAX_BYTES + 1), 'ktp.png').expect(413);
  });
  it('requires authentication', async () => {
    allowed = false;
    try { await request(app.getHttpServer()).post('/pppoe/id-card-photo').attach('file', png, 'ktp.png').expect(403); }
    finally { allowed = true; }
  });
  it('rejects arbitrary paths and missing references', async () => {
    await expect(validateIdCardPhoto('../../.env')).rejects.toThrow('Unggah foto KTP');
    await expect(validateIdCardPhoto('id-cards/00000000-0000-0000-0000-000000000000.png')).rejects.toThrow('tidak ditemukan');
  });
});
