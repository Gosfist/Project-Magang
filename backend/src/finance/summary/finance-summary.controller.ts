import { Controller, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';

import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { FinanceSummaryService } from './finance-summary.service.js';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('finance')
export class FinanceSummaryController {
  constructor(private readonly finance: FinanceSummaryService) {}

  @Get('summary')
  summary(
    @Query('month', new ParseIntPipe({ optional: true })) month?: number,
    @Query('year', new ParseIntPipe({ optional: true })) year?: number,
  ) {
    return this.finance.summary(month, year);
  }
}
