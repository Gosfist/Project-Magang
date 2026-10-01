import { Module } from '@nestjs/common';
import { IpPoolsController } from './ip-pools/ip-pools.controller.js';
import { IpPoolsService } from './ip-pools/ip-pools.service.js';
import { PaketLayananController } from './paket-layanan/paket-layanan.controller.js';
import { PaketLayananService } from './paket-layanan/paket-layanan.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { DataPelangganController } from './data-pelanggan/data-pelanggan.controller.js';
import { DataPelangganService } from './data-pelanggan/data-pelanggan.service.js';
import { RadiusService } from './shared/radius.service.js';
import { SecretService } from './shared/secret.service.js';
import { RouterModule } from '../router/router.module.js';
import { PppoeNetworkService } from './shared/pppoe-network.service.js';
import { CustomerServicesService } from './data-pelanggan/customer-services.service.js';
import { BillingIsolationService } from './data-pelanggan/billing-isolation.service.js';
import { PengaturanModule } from '../tools/pengaturan/pengaturan.module.js';
import { WhatsappNotifyService } from '../bot-whatsapp/shared/whatsapp-notify.service.js';

@Module({ imports: [AuthModule, RouterModule, PengaturanModule], controllers: [DataPelangganController, IpPoolsController, PaketLayananController], providers: [DataPelangganService, IpPoolsService, PaketLayananService, RadiusService, SecretService, PppoeNetworkService, CustomerServicesService, BillingIsolationService, WhatsappNotifyService], exports: [WhatsappNotifyService, RadiusService, SecretService, PppoeNetworkService] })
export class PppoeModule { }
