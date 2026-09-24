import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';
import { CommandsService } from './commands.service.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

@Module({
  imports: [AuthModule, TelemetryModule],
  controllers: [DevicesController, ActivityController],
  providers: [DevicesService, CommandsService, ActivityService],
  exports: [DevicesService, CommandsService, ActivityService],
})
export class DevicesModule {}
