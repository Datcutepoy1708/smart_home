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
import { AutomationsService } from './automations.service.js';
import { CreateRuleDto, UpdateRuleDto } from './automations.dto.js';

@ApiTags('automations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households/:householdId/rules')
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  @ApiOkResponse({ description: 'List automation rules for a household' })
  listRules(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
  ) {
    return this.automations.listRules(user.id, householdId);
  }

  @Post()
  @ApiOkResponse({ description: 'Create a new automation rule' })
  createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: CreateRuleDto,
  ) {
    return this.automations.createRule(user.id, householdId, dto);
  }

  @Patch(':ruleId')
  @ApiOkResponse({ description: 'Update or toggle an automation rule' })
  updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.automations.updateRule(user.id, householdId, ruleId, dto);
  }

  @Delete(':ruleId')
  @ApiOkResponse({ description: 'Delete an automation rule' })
  deleteRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.automations.deleteRule(user.id, householdId, ruleId);
  }
}
