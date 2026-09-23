import { Body, ConflictException, Controller, Delete, Get, Header, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ID_CARD_MAX_BYTES, readIdCardPhoto, storeIdCardPhoto } from './id-card-photo.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { SaveAccountDto, SavePackageDto } from './pppoe.dto.js';
import { SaveIpPoolDto } from './ip-pool.dto.js';
import { PppoeService } from './pppoe.service.js';
import { CustomerServicesService } from './customer-services.service.js';
import { CreateAddonDto, CreatePromiseDto } from './customer-services.dto.js';
import { BillingIsolationService } from './billing-isolation.service.js';
import { BillingSimulationDto } from '../settings/settings.dto.js';
import { SettingsService } from '../settings/settings.service.js';

@Controller('pppoe')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PppoeController {
  constructor(private readonly pppoe: PppoeService, private readonly customers: CustomerServicesService, private readonly billingIsolation: BillingIsolationService, private readonly settings: SettingsService) { }

  @Post('billing/simulate') async simulateBilling(@Body() dto: BillingSimulationDto) {
    const account = await this.settings.simulationAccount(dto.customerNumber);
    const completed = await this.billingIsolation.tick(new Date(dto.simulatedAt), account.id);
    if (!completed) throw new ConflictException('Pemeriksaan penagihan sedang berjalan. Coba lagi sebentar.');
    return { message: `Pemeriksaan simulasi selesai untuk ${account.customerName} (${account.customerNumber}). Periksa status invoice, WhatsApp, dan isolir.` };
  }

  @Post('id-card-photo')
  @Roles()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ID_CARD_MAX_BYTES, files: 1 } }))
  uploadIdCardPhoto(@UploadedFile() file?: { buffer: Buffer }) { return storeIdCardPhoto(file); }

  @Get('id-card-photo/:filename')
  @Roles()
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  idCardPhoto(@Param('filename') filename: string) { return readIdCardPhoto(filename); }

  @Get('ip-pools/options') ipPoolOptions() { return this.pppoe.ipPoolOptions(); }
  @Get('ip-pools') ipPools(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) { return this.pppoe.ipPools(search.trim(), Math.max(1, page)); }
  @Post('ip-pools') createIpPool(@Body() dto: SaveIpPoolDto) { return this.pppoe.createIpPool(dto); }
  @Patch('ip-pools/:id') updateIpPool(@Param('id') id: string, @Body() dto: SaveIpPoolDto) { return this.pppoe.updateIpPool(id, dto); }
  @Delete('ip-pools/:id') removeIpPool(@Param('id') id: string) { return this.pppoe.removeIpPool(id); }

  @Get('nas/options') @Roles('admin', 'teknisi') nasOptions() { return this.pppoe.nasOptions(); }
  @Get('odp/options') @Roles('admin', 'teknisi') odpOptions() { return this.pppoe.odpOptions(); }

  @Get('packages/options') @Roles('admin', 'sales', 'teknisi') packageOptions() { return this.pppoe.packageOptions(); }
  @Get('packages') packages(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1) { return this.pppoe.packages(search.trim(), Math.max(1, page)); }
  @Post('packages') createPackage(@Body() dto: SavePackageDto) { return this.pppoe.createPackage(dto); }
  @Patch('packages/:id') updatePackage(@Param('id') id: string, @Body() dto: SavePackageDto) { return this.pppoe.updatePackage(id, dto); }
  @Patch('packages/:id/status') togglePackage(@Param('id') id: string) { return this.pppoe.togglePackage(id); }
  @Delete('packages/:id') removePackage(@Param('id') id: string) { return this.pppoe.removePackage(id); }

  @Get('accounts') @Roles('admin', 'teknisi') accounts(@Query('search') search = '', @Query('page', new ParseIntPipe({ optional: true })) page = 1, @Query('status') status = '', @Query('session') session = '') { return this.pppoe.accounts(search.trim(), Math.max(1, page), status, session); }
  @Get('accounts/:id/auth-logs') authLogs(@Param('id') id: string) { return this.customers.authLogs(id); }
  @Get('accounts/:id/invoices') invoices(@Param('id') id: string) { return this.customers.invoices(id); }
  @Post('accounts/:id/invoices/:invoiceId/pay') payInvoice(@Param('id') id: string, @Param('invoiceId') invoiceId: string) { return this.customers.payInvoice(id, invoiceId); }
  @Get('accounts/:id/addons') addons(@Param('id') id: string) { return this.customers.addons(id); }
  @Post('accounts/:id/addons') createAddon(@Param('id') id: string, @Body() dto: CreateAddonDto) { return this.customers.createAddon(id, dto); }
  @Get('accounts/:id/promises') promises(@Param('id') id: string) { return this.customers.promises(id); }
  @Post('accounts/:id/promises') @Roles('admin', 'kolektor') createPromise(@Param('id') id: string, @Body() dto: CreatePromiseDto) { return this.customers.createPromise(id, dto); }
  @Post('accounts') createAccount(@Body() dto: SaveAccountDto) { return this.pppoe.createAccount(dto); }
  @Post('accounts/:id/disconnect') disconnectAccount(@Param('id') id: string) { return this.pppoe.disconnectAccount(id); }
  @Patch('accounts/:id') updateAccount(@Param('id') id: string, @Body() dto: SaveAccountDto) { return this.pppoe.updateAccount(id, dto); }
  @Delete('accounts/:id') removeAccount(@Param('id') id: string) { return this.pppoe.removeAccount(id); }
}
