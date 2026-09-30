import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @ApiProperty({
    description: 'Device FCM registration token',
    example: 'dK_1...fcm_token_string',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({
    description: 'Operating system / platform',
    example: 'android',
    default: 'android',
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  platform?: string;
}

export class UnregisterFcmTokenDto {
  @ApiProperty({
    description: 'Device FCM registration token to deactivate',
    example: 'dK_1...fcm_token_string',
  })
  @IsString()
  @IsNotEmpty()
  token!: string;
}

export class TestNotificationDto {
  @ApiPropertyOptional({
    description: 'Custom title for test notification',
    example: 'Kiểm tra thông báo Smart Home',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Custom message body for test notification',
    example: 'Hệ thống push notification đã hoạt động hoàn hảo!',
  })
  @IsString()
  @IsOptional()
  body?: string;
}
