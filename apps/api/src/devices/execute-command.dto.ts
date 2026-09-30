import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class ExecuteCommandDto {
  @ApiProperty({
    description: 'LIGHT/FAN: turn_on or turn_off. DOOR_SERVO: open, close, or set_angle. COVER: open, close, stop, open_cover, close_cover, stop_cover. SYSTEM: set_mode.',
    enum: ['turn_on', 'turn_off', 'open', 'close', 'set_angle', 'open_cover', 'close_cover', 'stop_cover', 'stop', 'set_mode'],
    example: 'set_angle',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['turn_on', 'turn_off', 'open', 'close', 'set_angle', 'open_cover', 'close_cover', 'stop_cover', 'stop', 'set_mode'])
  action!: 'turn_on' | 'turn_off' | 'open' | 'close' | 'set_angle' | 'open_cover' | 'close_cover' | 'stop_cover' | 'stop' | 'set_mode';

  @ApiPropertyOptional({
    description: 'Target angle in degrees for DOOR_SERVO (0 to 180). 0 is closed, >0 is open.',
    minimum: 0,
    maximum: 180,
    example: 90,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(180)
  angle?: number;

  @ApiPropertyOptional({
    description: 'Mode for system or device: auto or manual.',
    enum: ['auto', 'manual'],
    example: 'auto',
  })
  @IsOptional()
  @IsString()
  @IsIn(['auto', 'manual'])
  mode?: 'auto' | 'manual';
}
