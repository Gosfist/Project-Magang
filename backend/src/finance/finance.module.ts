import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PppoeModule } from '../pppoe/pppoe.module.js';
import { FinanceController } from './finance.controller.js';
import { FinanceService } from './finance.service.js';
import { DepositController } from './deposit.controller.js';
import { DepositService } from './deposit.service.js';

@Module({
  imports: [PrismaModule, PppoeModule],
  controllers: [FinanceController, DepositController],
  providers: [FinanceService, DepositService],
})
export class FinanceModule {}
