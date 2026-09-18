import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PppoeModule } from '../pppoe/pppoe.module.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { DepositController } from './deposit.controller.js';
import { DepositService } from './deposit.service.js';

@Module({
  imports: [AuthModule, PrismaModule, PppoeModule],
  controllers: [FinanceController, DepositController],
  providers: [FinanceService, DepositService],
})
export class FinanceModule {}
