import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import {
  RegisterFcmTokenDto,
  TestNotificationDto,
  UnregisterFcmTokenDto,
} from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('fcm-token')
  @ApiOperation({ summary: 'Register or update FCM device token' })
  async registerToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterFcmTokenDto,
  ) {
    await this.notifications.registerToken(user.id, dto);
    return { success: true, message: 'FCM token registered successfully' };
  }

  @Delete('fcm-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate FCM device token upon logout' })
  async unregisterToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnregisterFcmTokenDto,
  ) {
    await this.notifications.unregisterToken(user.id, dto.token);
    return { success: true, message: 'FCM token unregistered successfully' };
  }

  @Post('fcm-token/unregister')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate FCM device token upon logout (POST alternative)' })
  async unregisterTokenPost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnregisterFcmTokenDto,
  ) {
    await this.notifications.unregisterToken(user.id, dto.token);
    return { success: true, message: 'FCM token unregistered successfully' };
  }

  @Post('test')
  @ApiOperation({ summary: 'Send a test push notification to current user devices' })
  async testNotification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TestNotificationDto,
  ) {
    const result = await this.notifications.notifyUser(user.id, {
      title: dto.title ?? '🔔 Kiểm tra thông báo Smart Home',
      body: dto.body ?? 'Hệ thống thông báo đẩy FCM đã kết nối thành công!',
      data: { type: 'TEST_NOTIFICATION' },
    });
    return {
      success: true,
      result,
    };
  }
}
