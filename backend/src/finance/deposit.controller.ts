import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthRequest } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { DepositService } from './deposit.service.js';
import { CreateDepositDto, RejectDepositDto } from './deposit.dto.js';

@Controller('finance/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepositController {
  constructor(private readonly deposits: DepositService) {}

  @Get()
  @Roles('admin', 'finance', 'kolektor')
  list(
    @Req() req: AuthRequest,
    @Query('status') status = '',
    @Query('collectorId') collectorId = '',
    @Query('startDate') startDate = '',
    @Query('endDate') endDate = '',
    @Query('search') search = '',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
  ) {
    return this.deposits.list(status, req.user.role === 'kolektor' ? req.user.id : collectorId, startDate, endDate, search.trim(), Math.max(1, page));
  }

  @Get('unpaid-invoices')
  @Roles('admin', 'finance', 'kolektor')
  unpaidInvoices(@Query('search') search = '') {
    return this.deposits.unpaidInvoices(search.trim());
  }

  @Get('invoices')
  @Roles('admin', 'finance')
  invoices(@Query('search') search = '', @Query('status') status = '') {
    return this.deposits.invoiceOverview(search.trim(), status);
  }

  @Post()
  @Roles('admin', 'finance', 'kolektor')
  create(@Body() dto: CreateDepositDto, @Req() req: AuthRequest) {
    return this.deposits.create(dto, req.user.id);
  }

  @Patch(':id/accept')
  @Roles('admin', 'finance')
  accept(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.deposits.accept(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles('admin', 'finance')
  reject(@Param('id') id: string, @Body() dto: RejectDepositDto) {
    return this.deposits.reject(id, dto);
  }
}
