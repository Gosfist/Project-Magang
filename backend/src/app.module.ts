import { MonitoringModule } from './monitoring/monitoring.module.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { UsersModule } from './users/users.module.js';
import { MainCoreModule } from './main-core/main-core.module.js';
import { PppoeModule } from './pppoe/pppoe.module.js';
import { RouterModule } from './router/router.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    DashboardModule,
    UsersModule,
    MainCoreModule,
    PppoeModule,
    MonitoringModule,
    RouterModule,
  ],
})
export class AppModule {}
