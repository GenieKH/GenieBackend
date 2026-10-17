import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { BCRYPT_MAX_PASSWORD_BYTES, MaxBytes } from './max-bytes';

export class ChangePasswordDto {
  @ApiProperty({ description: 'The password in use now' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @ApiProperty({ description: 'The new password (min 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(200)
  @MaxBytes(BCRYPT_MAX_PASSWORD_BYTES)
  newPassword!: string;
}
