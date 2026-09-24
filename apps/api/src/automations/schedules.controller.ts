import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SchedulesService } from './schedules.service.js';
import { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto.js';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households/:householdId/schedules')
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  @ApiOkResponse({ description: 'List all household schedules' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
  ) {
    return this.schedules.listSchedules(user.id, householdId);
  }

  @Post()
  @ApiOkResponse({ description: 'Create a new schedule' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedules.createSchedule(user.id, householdId, dto);
  }

  @Patch(':scheduleId')
  @ApiOkResponse({ description: 'Update or toggle a schedule' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedules.updateSchedule(user.id, householdId, scheduleId, dto);
  }

  @Delete(':scheduleId')
  @ApiOkResponse({ description: 'Delete a schedule' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.schedules.deleteSchedule(user.id, householdId, scheduleId);
  }

  @Post(':scheduleId/trigger')
  @ApiOkResponse({ description: 'Manually trigger a schedule immediately' })
  trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
  ) {
    return this.schedules.triggerSchedule(user.id, householdId, scheduleId);
  }
}
