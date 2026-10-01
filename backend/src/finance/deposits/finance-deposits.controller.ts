import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import type { AuthRequest } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { FinanceDepositsService } from './finance-deposits.service.js';
import { CreateDepositDto, RejectDepositDto } from './finance-deposits.dto.js';

@Controller('finance/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceDepositsController {
  constructor(private readonly deposits: FinanceDepositsService) {}

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
