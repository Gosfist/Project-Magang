import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AreaController } from './area.controller.js';
import { AreaService } from './area.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [AreaController],
  providers: [AreaService],
  exports: [AreaService],
})
export class AreaModule {}
