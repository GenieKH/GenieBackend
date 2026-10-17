import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BCRYPT_MAX_PASSWORD_BYTES, MaxBytes } from './max-bytes';
import { normalizeEmailInput } from './normalize-email';
import { PHONE_NUMBER, PHONE_NUMBER_MESSAGE } from './phone-number';

export class RegisterDto {
  @ApiPropertyOptional({ description: 'User email address', example: 'user@example.com' })
  @ValidateIf(o => !o.phone)
  @IsEmail({}, { message: 'Must be a valid email if phone is not provided' })
  @IsNotEmpty()
  @Transform(normalizeEmailInput)
  email?: string;

  @ApiPropertyOptional({ description: 'User phone number', example: '+1234567890' })
  @ValidateIf(o => !o.email)
  @IsString()
  @IsNotEmpty({ message: 'Must provide a valid phone if email is not provided' })
  @Matches(PHONE_NUMBER, { message: PHONE_NUMBER_MESSAGE })
  phone?: string;

  @ApiProperty({ description: 'User password (min 8 characters)', example: 'strongpassword123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxBytes(BCRYPT_MAX_PASSWORD_BYTES)
  password!: string;
}
