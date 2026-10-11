import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { FinanceSalaryService } from './finance-salary.service.js';
import { SalarySettingsDto } from './finance-salary.dto.js';
@Controller('finance/salary')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('finance')
export class FinanceSalaryController {
  constructor(private readonly salary: FinanceSalaryService) {}
  @Get() settings() { return this.salary.settings(); }
  @Patch() update(@Body() dto: SalarySettingsDto) { return this.salary.update(dto); }
}
