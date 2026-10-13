import { Body, Controller, Get, Header, Param, ParseIntPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { AdminGuard } from '../../auth/roles.guard.js';
import { BackupService } from './backup.service.js';
import { BackupImportDto, BackupRouterDto, BackupScriptDto } from './backup.dto.js';
import { MAX_IMPORT_BYTES } from './backup-workbook.js';

// files + fields already cap the form at three parts. Busboy emits partsLimit
// when the configured count is reached, rejecting a valid file + mode + token.
const uploadOptions = { limits: { fileSize: MAX_IMPORT_BYTES, files: 1, fields: 2, fieldSize: 2048 } };

@Controller('settings/backup')
@UseGuards(JwtAuthGuard, AdminGuard)
export class BackupController {
  constructor(private readonly backup: BackupService) {}
  @Get('options') @Header('Cache-Control', 'private, no-store') options() { return this.backup.options(); }
  @Patch('router/:id') @Header('Cache-Control', 'private, no-store') settings(@Param('id', ParseIntPipe) id: number, @Body() dto: BackupRouterDto) { return this.backup.saveSettings(id, dto); }
  @Post('router/:id/script') @Header('Cache-Control', 'private, no-store') script(@Param('id', ParseIntPipe) id: number, @Body() dto: BackupScriptDto) { return this.backup.script(id, dto.mode, dto.reconnect); }
  @Get('template') @Header('Cache-Control', 'private, no-store') template() { return this.backup.workbook(true); }
  @Get('excel') @Header('Cache-Control', 'private, no-store') excel(@Query('routerId', new ParseIntPipe({ optional: true })) routerId?: number) { return this.backup.workbook(false, routerId); }
  @Post('preview')
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  preview(@UploadedFile() file: { buffer: Buffer } | undefined, @Body() dto: BackupImportDto, @Req() req: { user: { id: string } }) { return this.backup.preview(file?.buffer, dto.mode, req.user.id); }
  @Post('import')
  @Header('Cache-Control', 'private, no-store')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  import(@UploadedFile() file: { buffer: Buffer } | undefined, @Body() dto: BackupImportDto, @Req() req: { user: { id: string } }) { return this.backup.import(file?.buffer, dto, req.user.id); }
}
