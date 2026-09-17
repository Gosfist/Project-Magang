import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BillingSettingsDto } from './settings.dto.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('billing') billing() {
    return this.settings.billing();
  }

  @Patch('billing') updateBilling(@Body() dto: BillingSettingsDto) {
    return this.settings.updateBilling(dto);
  }
}
