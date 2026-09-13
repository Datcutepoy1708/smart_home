import { ApiProperty } from '@nestjs/swagger';
class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'email' }) email!: string;
}
class HouseholdResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['owner', 'member', 'guest'] }) role!: string;
}
class TokensResponseDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ description: 'Access token lifetime in seconds' })
  accessTokenExpiresIn!: number;
}
export class IdentityResponseDto {
  @ApiProperty({ type: UserResponseDto }) user!: UserResponseDto;
  @ApiProperty({ type: [HouseholdResponseDto] })
  households!: HouseholdResponseDto[];
}
export class AuthResponseDto extends IdentityResponseDto {
  @ApiProperty({ type: TokensResponseDto }) tokens!: TokensResponseDto;
}
