import { Module } from '@nestjs/common';
import { HouseholdsService } from './households.service.js';

@Module({
  exports: [HouseholdsService],
  providers: [HouseholdsService],
})
export class HouseholdsModule {}
