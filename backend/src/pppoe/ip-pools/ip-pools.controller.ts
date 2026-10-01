import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { RolesGuard } from '../../auth/roles.guard.js';
import { Roles } from '../../auth/roles.decorator.js';

import { SaveIpPoolDto } from './ip-pools.dto.js';
import { IpPoolsService } from './ip-pools.service.js';
import { CustomerServicesService } from '../data-pelanggan/customer-services.service.js';

import { BillingIsolationService } from '../data-pelanggan/billing-isolation.service.js';

import { PengaturanService } from '../../tools/pengaturan/pengaturan.service.js';

@Controller('pppoe')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class IpPoolsController {
  constructor(private readonly pppoe: IpPoolsService, private readonly customers: CustomerServicesService, private readonly billingIsolation: BillingIsolationService, private readonly settings: PengaturanService) { }

  @Get('ip-pools/options') ipPoolOptions() { return this.pppoe.ipPoolOptions(); }
  @Get('ip-pools') ipPools(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) { return this.pppoe.ipPools(search.trim(), Math.max(1, page)); }
  @Post('ip-pools') createIpPool(@Body() dto: SaveIpPoolDto) { return this.pppoe.createIpPool(dto); }
  @Patch('ip-pools/:id') updateIpPool(@Param('id') id: string, @Body() dto: SaveIpPoolDto) { return this.pppoe.updateIpPool(id, dto); }
  @Delete('ip-pools/:id') removeIpPool(@Param('id') id: string) { return this.pppoe.removeIpPool(id); }
}
