import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { PengaturanController } from './pengaturan.controller.js';
import { PengaturanService } from './pengaturan.service.js';

@Module({ imports: [AuthModule], controllers: [PengaturanController], providers: [PengaturanService], exports: [PengaturanService] })
export class PengaturanModule {}
