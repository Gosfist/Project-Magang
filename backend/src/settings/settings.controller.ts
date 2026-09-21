import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/roles.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BillingSettingsDto } from './settings.dto.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('billing') async billing() {
    const [billing, psb] = await Promise.all([this.settings.billing(), this.settings.psb()]);
    return { ...billing, psbPaymentMode: psb.paymentMode, psbFee: psb.installationFee };
  }

  @Patch('billing') updateBilling(@Body() dto: BillingSettingsDto) {
    return this.settings.updateBilling(dto);
  }
}
