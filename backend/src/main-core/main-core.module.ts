import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MainCoreController } from './shared/main-core.controller.js';
import { MainCoreService } from './shared/main-core.service.js';
import { ServerController } from './server/server.controller.js';
import { RasioController } from './rasio/rasio.controller.js';
import { OdcController } from './odc/odc.controller.js';
import { OdpController } from './odp/odp.controller.js';
import { TraceJalurController } from './trace-jalur/trace-jalur.controller.js';

@Module({ imports: [AuthModule], controllers: [MainCoreController, ServerController, RasioController, OdcController, OdpController, TraceJalurController], providers: [MainCoreService] })
export class MainCoreModule { }
