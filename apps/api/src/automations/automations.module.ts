import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { AutomationsController } from './automations.controller.js';
import { AutomationsService } from './automations.service.js';
import { SchedulesController } from './schedules.controller.js';
import { SchedulesService } from './schedules.service.js';
import { ScenesController } from './scenes.controller.js';
import { ScenesService } from './scenes.service.js';
import { TimersController } from './timers.controller.js';
import { TimersService } from './timers.service.js';

@Module({
  imports: [PrismaModule, DevicesModule, TelemetryModule],
  controllers: [
    AutomationsController,
    SchedulesController,
    ScenesController,
    TimersController,
  ],
  providers: [
    AutomationsService,
    SchedulesService,
    ScenesService,
    TimersService,
  ],
  exports: [
    AutomationsService,
    SchedulesService,
    ScenesService,
    TimersService,
  ],
})
export class AutomationsModule {}

