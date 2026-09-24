import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ReadingsQueryDto {
  @ApiPropertyOptional({
    description: 'Time range for sensor readings',
    enum: ['24h', '7d', 'all'],
    default: '24h',
  })
  @IsOptional()
  @IsIn(['24h', '7d', 'all'])
  range?: '24h' | '7d' | 'all' = '24h';

  @ApiPropertyOptional({
    description: 'Specific metric to filter (temperature, humidity)',
    enum: ['temperature', 'humidity'],
  })
  @IsOptional()
  @IsIn(['temperature', 'humidity'])
  metric?: 'temperature' | 'humidity';

  @ApiPropertyOptional({
    description: 'Maximum number of data points to return',
    default: 100,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;
}
