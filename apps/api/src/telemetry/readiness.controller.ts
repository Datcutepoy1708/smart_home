import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { MqttService } from './mqtt.service.js';
@ApiTags('health')
@Controller('health')
export class ReadinessController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttService,
  ) {}
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
    if (!this.mqtt.connected)
      throw new ServiceUnavailableException('MQTT unavailable');
    return { status: 'ok', database: 'connected', mqtt: 'connected' };
  }
}
