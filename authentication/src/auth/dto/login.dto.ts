import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { normalizeEmailInput } from './normalize-email';

export class LoginDto {
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
  phone?: string;

  @ApiProperty({ description: 'User password', example: 'strongpassword123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}
