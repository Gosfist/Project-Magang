import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';

import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { FinanceInvoicesService } from './finance-invoices.service.js';

@Controller('finance/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceInvoicesController {
  constructor(private readonly deposits: FinanceInvoicesService) {}

  @Get('unpaid-invoices')
  @Roles('admin', 'finance', 'kolektor')
  unpaidInvoices(@Query('search') search = '') {
    return this.deposits.unpaidInvoices(search.trim());
  }

  @Get('invoices')
  @Roles('finance')
  invoices(@Query('search') search = '', @Query('status') status = '') {
    return this.deposits.invoiceOverview(search.trim(), status);
  }
}
