import { Test } from '@nestjs/testing';
import { ValidationPipe, type ExecutionContext, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { BackupController } from './backup.controller.js';
import { BackupService } from './backup.service.js';

describe('Backup multipart upload over HTTP', () => {
  let app: INestApplication;
  let workbook: Buffer;
  const preview = vi.fn(async () => ({ total: 1, token: 'preview-ticket' }));
  const importFile = vi.fn(async () => ({ created: 1 }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BackupController], providers: [{ provide: BackupService, useValue: { preview, import: importFile } }],
    }).overrideGuard(JwtAuthGuard).useValue({ canActivate: (context: ExecutionContext) => {
      context.switchToHttp().getRequest().user = { id: '1', role: 'admin' }; return true;
    } }).compile();
    app = module.createNestApplication(); app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    const book = new ExcelJS.Workbook(); book.addWorksheet('Akun PPPoE').addRow(['no_pelanggan', 'username']);
    workbook = Buffer.from(await book.xlsx.writeBuffer());
  });
  beforeEach(() => { preview.mockClear(); importFile.mockClear(); });
  afterAll(async () => { await app?.close(); });

  it('accepts Periksa File with one workbook and the mode field', async () => {
    await request(app.getHttpServer()).post('/settings/backup/preview').attach('file', workbook, 'backup.xlsx').field('mode', 'create').expect(201);
    expect(preview).toHaveBeenCalledWith(workbook, 'create', '1');
  });
  it('accepts preview with an optional token field at the supported field limit', async () => {
    await request(app.getHttpServer()).post('/settings/backup/preview').field('mode', 'upsert').field('token', 'previous-ticket').attach('file', workbook, 'backup.xlsx').expect(201);
    expect(preview).toHaveBeenCalledWith(workbook, 'upsert', '1');
  });
  it('accepts Import with file, mode and preview token regardless of file order', async () => {
    await request(app.getHttpServer()).post('/settings/backup/import').attach('file', workbook, 'backup.xlsx').field('mode', 'upsert').field('token', 'preview-ticket').expect(201);
    expect(importFile).toHaveBeenCalledWith(workbook, expect.objectContaining({ mode: 'upsert', token: 'preview-ticket' }), '1');
  });
  it('still rejects more than two form fields before importing', async () => {
    await request(app.getHttpServer()).post('/settings/backup/import').field('mode', 'upsert').field('token', 'preview-ticket').field('extra', 'invalid').attach('file', workbook, 'backup.xlsx').expect(400);
    expect(importFile).not.toHaveBeenCalled();
  });
  it('still rejects a second uploaded file before importing', async () => {
    await request(app.getHttpServer()).post('/settings/backup/import').field('mode', 'upsert').attach('file', workbook, 'backup.xlsx').attach('file', workbook, 'other.xlsx').expect(400);
    expect(importFile).not.toHaveBeenCalled();
  });
});
