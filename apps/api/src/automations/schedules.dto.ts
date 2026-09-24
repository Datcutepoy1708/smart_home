import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateScheduleDto {
  @ApiProperty({ description: 'Target device ID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  deviceId: string;

  @ApiPropertyOptional({ description: 'Descriptive name for the schedule' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description: 'Time of day in 24h format (HH:mm)',
    example: '07:30',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in 24-hour format HH:mm (e.g. 07:30, 22:00)',
  })
  time: string;

  @ApiProperty({
    description: 'Action to execute on target device',
    enum: ['turn_on', 'turn_off', 'open', 'close', 'set_angle'],
  })
  @IsString()
  @IsIn(['turn_on', 'turn_off', 'open', 'close', 'set_angle'])
  action: 'turn_on' | 'turn_off' | 'open' | 'close' | 'set_angle';

  @ApiPropertyOptional({
    description: 'Additional parameters (e.g. { angle: 90 })',
    example: { angle: 90 },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Days of week to repeat: 1 (Mon) to 7 (Sun). Defaults to everyday [1,2,3,4,5,6,7]. Empty array for one-time.',
    example: [1, 2, 3, 4, 5, 6, 7],
    default: [1, 2, 3, 4, 5, 6, 7],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  repeatDays?: number[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'Target device ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Descriptive name for the schedule' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Time of day in 24h format (HH:mm)',
    example: '07:30',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in 24-hour format HH:mm (e.g. 07:30, 22:00)',
  })
  time?: string;

  @ApiPropertyOptional({
    description: 'Action to execute on target device',
    enum: ['turn_on', 'turn_off', 'open', 'close', 'set_angle'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['turn_on', 'turn_off', 'open', 'close', 'set_angle'])
  action?: 'turn_on' | 'turn_off' | 'open' | 'close' | 'set_angle';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  repeatDays?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
