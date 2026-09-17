import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PppoeController } from './pppoe.controller.js';
import { PppoeService } from './pppoe.service.js';
import { RadiusService } from './radius.service.js';
import { SecretService } from './secret.service.js';
import { RouterModule } from '../router/router.module.js';
import { PppoeNetworkService } from './pppoe-network.service.js';
import { CustomerServicesService } from './customer-services.service.js';

@Module({ imports: [AuthModule, RouterModule], controllers: [PppoeController], providers: [PppoeService, RadiusService, SecretService, PppoeNetworkService, CustomerServicesService] })
export class PppoeModule { }
