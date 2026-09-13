import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ writeOnly: true })
  @IsJWT()
  refreshToken!: string;
}
