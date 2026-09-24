import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { EnergyService } from './energy.service.js';
import { UpdateDevicePowerDto } from './energy.dto.js';

@ApiTags('energy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households/:householdId/energy')
export class EnergyController {
  constructor(private readonly energyService: EnergyService) {}

  @Get('summary')
  @ApiOkResponse({ description: 'Get energy consumption summary and cost estimates' })
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
  ) {
    return this.energyService.getEnergySummary(user.id, householdId);
  }

  @Get('chart')
  @ApiOkResponse({ description: 'Get energy consumption chart data (today, week, month)' })
  getChart(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query('range') range?: 'today' | 'week' | 'month',
  ) {
    return this.energyService.getEnergyChart(user.id, householdId, range || 'today');
  }

  @Get('breakdown')
  @ApiOkResponse({ description: 'Get device-level energy consumption breakdown' })
  getBreakdown(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Query('period') period?: 'today' | 'week' | 'month',
  ) {
    return this.energyService.getDeviceBreakdown(user.id, householdId, period || 'today');
  }

  @Patch('devices/:deviceId/power')
  @ApiOkResponse({ description: 'Update rated wattage for a device' })
  updatePower(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() dto: UpdateDevicePowerDto,
  ) {
    return this.energyService.updateDevicePower(
      user.id,
      householdId,
      deviceId,
      dto.wattage,
    );
  }
}
