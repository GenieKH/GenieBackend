import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ description: 'The long-lived refresh token' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
