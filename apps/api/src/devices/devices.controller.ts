import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { DevicesService } from './devices.service.js';
import { DeviceQueryDto } from './device-query.dto.js';
@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households/:householdId/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}
  @Get()
  @ApiOkResponse({
    description:
      'Cursor-paginated household devices with latest temperature/humidity, server lastSeenAt and derived online state.',
    schema: {
      type: 'object',
      required: ['items', 'nextCursor'],
      properties: {
        nextCursor: { type: 'string', format: 'uuid', nullable: true },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              room: { type: 'string', nullable: true },
              deviceType: { type: 'string' },
              isOnline: { type: 'boolean' },
              lastSeenAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              readings: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    metric: { type: 'string' },
                    value: { type: 'number' },
                    unit: { type: 'string' },
                    recordedAt: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query() query: DeviceQueryDto,
  ) {
    return this.devices.list(user.id, householdId, query);
  }
}
