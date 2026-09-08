import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module.js';
import { MonitoringController } from './monitoring.controller.js';
import { MonitoringService, MonitoringInterceptor } from './monitoring.service.js';

@Module({ imports: [AuthModule], controllers: [MonitoringController], providers: [MonitoringService, { provide: APP_INTERCEPTOR, useClass: MonitoringInterceptor }] })
export class MonitoringModule {}
