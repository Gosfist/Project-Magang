import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';

import { SavePackageDto } from './paket-layanan.dto.js';

import { PaketLayananService } from './paket-layanan.service.js';
import { CustomerServicesService } from '../data-pelanggan/customer-services.service.js';

import { BillingIsolationService } from '../data-pelanggan/billing-isolation.service.js';

import { PengaturanService } from '../../tools/pengaturan/pengaturan.service.js';

@Controller('pppoe')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PaketLayananController {
  constructor(private readonly pppoe: PaketLayananService, private readonly customers: CustomerServicesService, private readonly billingIsolation: BillingIsolationService, private readonly settings: PengaturanService) { }

  @Get('packages/options') @Roles('admin', 'sales', 'teknisi') packageOptions() { return this.pppoe.packageOptions(); }
  @Get('packages') packages(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) { return this.pppoe.packages(search.trim(), Math.max(1, page)); }
  @Post('packages') createPackage(@Body() dto: SavePackageDto) { return this.pppoe.createPackage(dto); }
  @Patch('packages/:id') updatePackage(@Param('id') id: string, @Body() dto: SavePackageDto) { return this.pppoe.updatePackage(id, dto); }
  @Patch('packages/:id/status') togglePackage(@Param('id') id: string) { return this.pppoe.togglePackage(id); }
  @Delete('packages/:id') removePackage(@Param('id') id: string) { return this.pppoe.removePackage(id); }
}
