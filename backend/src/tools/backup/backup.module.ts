import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { PppoeModule } from '../../pppoe/pppoe.module.js';
import { BackupController } from './backup.controller.js';
import { BackupService } from './backup.service.js';

@Module({ imports: [AuthModule, PppoeModule], controllers: [BackupController], providers: [BackupService] })
export class BackupModule {}
