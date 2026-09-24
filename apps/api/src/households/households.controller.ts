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
import { HouseholdsService } from './households.service.js';
import {
  CreateHouseholdDto,
  CreateInviteCodeDto,
  JoinHouseholdDto,
  UpdateMemberRoleDto,
} from './household-members.dto.js';

@ApiTags('households')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get(':householdId/members')
  @ApiOkResponse({ description: 'List members of a household' })
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
  ) {
    return this.householdsService.listMembers(user.id, householdId);
  }

  @Post(':householdId/invites')
  @ApiOkResponse({ description: 'Generate a 6-character invite code for the household' })
  createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: CreateInviteCodeDto,
  ) {
    return this.householdsService.createInviteCode(
      user.id,
      householdId,
      dto.role,
      dto.validHours,
    );
  }

  @Post('join')
  @ApiOkResponse({ description: 'Join a household using an invite code' })
  joinByCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: JoinHouseholdDto,
  ) {
    return this.householdsService.joinHouseholdByCode(user.id, dto.code);
  }

  @Patch(':householdId/members/:memberId')
  @ApiOkResponse({ description: 'Update a member role or expiration' })
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.householdsService.updateMemberRole(
      user.id,
      householdId,
      memberId,
      dto.role,
      dto.expiresAt,
    );
  }

  @Delete(':householdId/members/:memberId')
  @ApiOkResponse({ description: 'Remove a member or leave household' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.householdsService.removeMember(user.id, householdId, memberId);
  }

  @Post()
  @ApiOkResponse({ description: 'Create a new household' })
  createHousehold(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHouseholdDto,
  ) {
    return this.householdsService.createHousehold(user.id, dto.name);
  }
}
