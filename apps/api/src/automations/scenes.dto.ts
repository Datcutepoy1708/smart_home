import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SceneActionDto {
  @ApiProperty({ description: 'Target device ID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  deviceId: string;

  @ApiProperty({ description: 'Action to execute', example: 'turn_on' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({ description: 'Optional parameters like angle', example: { angle: 90 } })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class CreateSceneDto {
  @ApiProperty({ description: 'Scene name', example: 'Về nhà' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Icon name', example: 'home' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ type: [SceneActionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SceneActionDto)
  actions: SceneActionDto[];
}
