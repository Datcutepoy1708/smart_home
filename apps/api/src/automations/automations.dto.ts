import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRuleDto {
  @ApiProperty({ description: 'Name of the automation rule', example: 'Tự bật quạt khi trời nóng' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Trigger condition definition',
    example: { metric: 'temperature', operator: '>', value: 30 },
  })
  @IsObject()
  condition!: {
    metric: 'temperature' | 'humidity';
    operator: '>' | '<' | '>=' | '<=';
    value: number;
    deviceId?: string;
  };

  @ApiProperty({
    description: 'Action to execute when condition is met',
    example: { targetDeviceId: 'aa40a477-80f8-4f79-a27c-471904d398d4', action: 'turn_on', params: { power: 'on' } },
  })
  @IsObject()
  action!: {
    targetDeviceId: string;
    action: string;
    params?: Record<string, unknown>;
  };

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  action?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
