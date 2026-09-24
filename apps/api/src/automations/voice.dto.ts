import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoiceCommandDto {
  @ApiProperty({
    description: 'Natural language speech transcript in Vietnamese',
    example: 'Mở cửa 90 độ',
  })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class VoiceResponseDto {
  success: boolean;
  message: string;
  transcript: string;
  matchedType?: 'DEVICE' | 'SCENE' | 'QUERY' | 'UNKNOWN';
  deviceName?: string;
  action?: string;
  angle?: number;
  data?: Record<string, unknown>;
}
