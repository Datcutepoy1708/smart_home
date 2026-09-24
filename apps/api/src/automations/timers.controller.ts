import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { TimersService } from './timers.service.js';

class SetTimerDto {
  durationMinutes: number;
  action: string;
  angle?: number;
}

@ApiTags('timers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households/:householdId/devices/:deviceId/timer')
export class TimersController {
  constructor(private readonly timers: TimersService) {}

  @Get()
  @ApiOkResponse({ description: 'Get active countdown timer for device' })
  getTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.timers.getTimer(user.id, householdId, deviceId);
  }

  @Post()
  @ApiOkResponse({ description: 'Set a countdown timer on device' })
  setTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: SetTimerDto,
  ) {
    return this.timers.setTimer(user.id, householdId, deviceId, dto);
  }

  @Delete()
  @ApiOkResponse({ description: 'Cancel active countdown timer on device' })
  cancelTimer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
  ) {
    return this.timers.cancelTimer(user.id, householdId, deviceId);
  }
}
