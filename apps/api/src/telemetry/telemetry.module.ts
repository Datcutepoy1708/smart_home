import { Module } from '@nestjs/common';
import { MqttService } from './mqtt.service.js';
import { TelemetryService } from './telemetry.service.js';
import { ReadinessController } from './readiness.controller.js';
@Module({
  controllers: [ReadinessController],
  providers: [TelemetryService, MqttService],
  exports: [MqttService, TelemetryService],
})
export class TelemetryModule {}
