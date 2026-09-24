import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { DevicesService } from './devices.service.js';
import { CommandsService } from './commands.service.js';
import { DeviceQueryDto } from './device-query.dto.js';
import { ExecuteCommandDto } from './execute-command.dto.js';
import { ReadingsQueryDto } from './readings-query.dto.js';
@ApiTags('devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households/:householdId/devices')
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly commands: CommandsService,
  ) {}
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
              state: {
                type: 'object',
                properties: {
                  power: { type: 'string', enum: ['on', 'off'] },
                },
              },
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

  @Get(':deviceId')
  @ApiOkResponse({
    description:
      'Device details with latest temperature/humidity, server lastSeenAt and derived online state.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        room: { type: 'string', nullable: true },
        deviceType: { type: 'string' },
        isOnline: { type: 'boolean' },
        state: {
          type: 'object',
          properties: {
            power: { type: 'string', enum: ['on', 'off'] },
            position: { type: 'string', enum: ['open', 'closed'] },
            angle: { type: 'integer', minimum: 0, maximum: 180 },
          },
        },
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
  })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.devices.getById(user.id, householdId, deviceId);
  }

  @Get(':deviceId/readings')
  @ApiOkResponse({
    description: 'Get historical sensor readings for charting',
    schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', format: 'uuid' },
        readings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              metric: { type: 'string' },
              value: { type: 'number' },
              unit: { type: 'string' },
              recordedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  getReadings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Query() query: ReadingsQueryDto,
  ) {
    return this.devices.getReadings(user.id, householdId, deviceId, query);
  }

  @Post(':deviceId/commands')
  @ApiOkResponse({
    description: 'Executes a command on the device and returns the updated state after device ACK.',
    schema: {
      type: 'object',
      properties: {
        commandId: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'ACKNOWLEDGED' },
        state: {
          type: 'object',
          properties: {
            power: { type: 'string', enum: ['on', 'off'] },
          },
        },
      },
    },
  })
  executeCommand(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: ExecuteCommandDto,
  ) {
    return this.commands.executeCommand(user.id, householdId, deviceId, dto);
  }
}
