import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MainCoreController } from './main-core.controller.js';
import { MainCoreService } from './main-core.service.js';

@Module({ imports: [AuthModule], controllers: [MainCoreController], providers: [MainCoreService] })
export class MainCoreModule { }
