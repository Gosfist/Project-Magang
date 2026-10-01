import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../auth/roles.guard.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { BillingSettingsDto } from './pengaturan.dto.js';
import { PengaturanService } from './pengaturan.service.js';

@Controller('settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PengaturanController {
  constructor(private readonly settings: PengaturanService) {}

  @Get('billing') async billing() {
    const [billing, psb] = await Promise.all([this.settings.billing(), this.settings.psb()]);
    return { ...billing, psbFee: psb.installationFee };
  }

  @Patch('billing') updateBilling(@Body() dto: BillingSettingsDto) {
    return this.settings.updateBilling(dto);
  }
}
