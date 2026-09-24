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
import { ScenesService } from './scenes.service.js';
import { CreateSceneDto } from './scenes.dto.js';

@ApiTags('scenes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households/:householdId/scenes')
export class ScenesController {
  constructor(private readonly scenes: ScenesService) {}

  @Get()
  @ApiOkResponse({ description: 'List all household scenes' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
  ) {
    return this.scenes.listScenes(user.id, householdId);
  }

  @Post(':sceneId/trigger')
  @ApiOkResponse({ description: 'Execute all actions in a scene' })
  trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
  ) {
    return this.scenes.triggerScene(user.id, householdId, sceneId);
  }

  @Post()
  @ApiOkResponse({ description: 'Create a new scene' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: CreateSceneDto,
  ) {
    return this.scenes.createScene(user.id, householdId, dto);
  }

  @Delete(':sceneId')
  @ApiOkResponse({ description: 'Delete a scene' })
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Param('sceneId', ParseUUIDPipe) sceneId: string,
  ) {
    return this.scenes.deleteScene(user.id, householdId, sceneId);
  }
}
