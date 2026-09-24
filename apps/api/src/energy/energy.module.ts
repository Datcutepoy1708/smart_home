import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EnergyController } from './energy.controller.js';
import { EnergyService } from './energy.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [EnergyController],
  providers: [EnergyService],
  exports: [EnergyService],
})
export class EnergyModule {}
