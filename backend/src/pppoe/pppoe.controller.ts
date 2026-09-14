import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SaveAccountDto, SavePackageDto } from './pppoe.dto.js';
import { SaveIpPoolDto } from './ip-pool.dto.js';
import { PppoeService } from './pppoe.service.js';

@Controller('pppoe')
@UseGuards(JwtAuthGuard)
export class PppoeController {
  constructor(private readonly pppoe: PppoeService) { }

  @Get('ip-pools/options') ipPoolOptions() { return this.pppoe.ipPoolOptions(); }
  @Get('ip-pools') ipPools(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) { return this.pppoe.ipPools(search.trim(), Math.max(1, page)); }
  @Post('ip-pools') createIpPool(@Body() dto: SaveIpPoolDto) { return this.pppoe.createIpPool(dto); }
  @Post('ip-pools/:id/sync') syncIpPool(@Param('id') id: string) { return this.pppoe.syncIpPool(id); }
  @Patch('ip-pools/:id') updateIpPool(@Param('id') id: string, @Body() dto: SaveIpPoolDto) { return this.pppoe.updateIpPool(id, dto); }
  @Delete('ip-pools/:id') removeIpPool(@Param('id') id: string) { return this.pppoe.removeIpPool(id); }

  @Get('nas/options') nasOptions() { return this.pppoe.nasOptions(); }
  @Get('odp/options') odpOptions() { return this.pppoe.odpOptions(); }

  @Get('packages/options') packageOptions() { return this.pppoe.packageOptions(); }
  @Get('packages') packages(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) { return this.pppoe.packages(search.trim(), Math.max(1, page)); }
  @Post('packages') createPackage(@Body() dto: SavePackageDto) { return this.pppoe.createPackage(dto); }
  @Patch('packages/:id') updatePackage(@Param('id') id: string, @Body() dto: SavePackageDto) { return this.pppoe.updatePackage(id, dto); }
  @Patch('packages/:id/status') togglePackage(@Param('id') id: string) { return this.pppoe.togglePackage(id); }
  @Delete('packages/:id') removePackage(@Param('id') id: string) { return this.pppoe.removePackage(id); }

  @Get('accounts') accounts(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) { return this.pppoe.accounts(search.trim(), Math.max(1, page)); }
  @Post('accounts') createAccount(@Body() dto: SaveAccountDto) { return this.pppoe.createAccount(dto); }
  @Post('accounts/:id/disconnect') disconnectAccount(@Param('id') id: string) { return this.pppoe.disconnectAccount(id); }
  @Patch('accounts/:id') updateAccount(@Param('id') id: string, @Body() dto: SaveAccountDto) { return this.pppoe.updateAccount(id, dto); }
  @Delete('accounts/:id') removeAccount(@Param('id') id: string) { return this.pppoe.removeAccount(id); }
}
