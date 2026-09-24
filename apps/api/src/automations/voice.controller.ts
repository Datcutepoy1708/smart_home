import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { VoiceService } from './voice.service.js';
import { VoiceCommandDto, VoiceResponseDto } from './voice.dto.js';

@ApiTags('voice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('households/:householdId/voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post('command')
  @ApiOkResponse({
    description: 'Process a natural language voice command in Vietnamese',
    type: VoiceResponseDto,
  })
  processCommand(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @Body() dto: VoiceCommandDto,
  ) {
    return this.voice.processVoiceCommand(user.id, householdId, dto);
  }
}
