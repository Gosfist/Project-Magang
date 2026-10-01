import { MonitoringModule } from './monitoring/monitoring.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HomeModule } from './home/home.module.js';
import { UsersModule } from './users/users.module.js';
import { MainCoreModule } from './main-core/main-core.module.js';
import { PppoeModule } from './pppoe/pppoe.module.js';
import { RouterModule } from './router/router.module.js';
import { PengaturanModule } from './tools/pengaturan/pengaturan.module.js';
import { AreaModule } from './area/area.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { PsbModule } from './psb/psb.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HomeModule,
    UsersModule,
    MainCoreModule,
    PppoeModule,
    MonitoringModule,
    RouterModule,
    PengaturanModule,
    AreaModule,
    FinanceModule,
    PsbModule,
  ],
})
export class AppModule {}
