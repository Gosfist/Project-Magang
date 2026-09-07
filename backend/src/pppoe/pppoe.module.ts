import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PppoeController } from './pppoe.controller.js';
import { PppoeService } from './pppoe.service.js';
import { RadiusService } from './radius.service.js';
import { SecretService } from './secret.service.js';

@Module({ imports: [AuthModule], controllers: [PppoeController], providers: [PppoeService, RadiusService, SecretService] })
export class PppoeModule { }
