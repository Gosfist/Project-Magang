import { PayrollService } from './salary/payroll.service.js';
import { PayrollController, EmployeeAttendanceController } from './salary/payroll.controller.js';
import { FinanceSalaryService } from './salary/finance-salary.service.js';
import { FinanceSalaryController } from './salary/finance-salary.controller.js';
import { Module } from '@nestjs/common';
import { FinanceSummaryController } from './summary/finance-summary.controller.js';
import { FinanceSummaryService } from './summary/finance-summary.service.js';
import { FinanceInvoicesController } from './invoices/finance-invoices.controller.js';
import { FinanceInvoicesService } from './invoices/finance-invoices.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PppoeModule } from '../pppoe/pppoe.module.js';
import { FinanceTransactionsController } from './transactions/finance-transactions.controller.js';
import { FinanceTransactionsService } from './transactions/finance-transactions.service.js';
import { FinanceDepositsController } from './deposits/finance-deposits.controller.js';
import { FinanceDepositsService } from './deposits/finance-deposits.service.js';

@Module({
  imports: [AuthModule, PrismaModule, PppoeModule],
  exports: [FinanceSalaryService, PayrollService],
  controllers: [PayrollController, EmployeeAttendanceController, FinanceSalaryController, FinanceTransactionsController, FinanceDepositsController, FinanceSummaryController, FinanceInvoicesController],
  providers: [PayrollService, FinanceSalaryService, FinanceTransactionsService, FinanceDepositsService, FinanceSummaryService, FinanceInvoicesService],
})
export class FinanceModule {}
