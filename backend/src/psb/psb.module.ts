import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PppoeModule } from '../pppoe/pppoe.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { PsbController } from './psb.controller.js';
import { PsbService } from './psb.service.js';

@Module({ imports: [AuthModule, PppoeModule, SettingsModule], controllers: [PsbController], providers: [PsbService] })
export class PsbModule {}
