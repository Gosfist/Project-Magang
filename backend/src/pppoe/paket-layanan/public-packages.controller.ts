import { Controller, Get, Header } from '@nestjs/common';
import { PaketLayananService } from './paket-layanan.service.js';

@Controller('public/packages')
export class PublicPackagesController {
  constructor(private readonly packages: PaketLayananService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list() { return this.packages.publicPackages(); }
}
