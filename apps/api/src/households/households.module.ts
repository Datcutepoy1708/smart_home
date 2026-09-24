import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HouseholdsController } from './households.controller.js';
import { HouseholdsService } from './households.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [HouseholdsController],
  providers: [HouseholdsService],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
