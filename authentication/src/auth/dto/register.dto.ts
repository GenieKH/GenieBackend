import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiPropertyOptional({ description: 'User email address', example: 'user@example.com' })
  @ValidateIf(o => !o.phone)
  @IsEmail({}, { message: 'Must be a valid email if phone is not provided' })
  @IsNotEmpty()
  email?: string;

  @ApiPropertyOptional({ description: 'User phone number', example: '+1234567890' })
  @ValidateIf(o => !o.email)
  @IsString()
  @IsNotEmpty({ message: 'Must provide a valid phone if email is not provided' })
  phone?: string;

  @ApiProperty({ description: 'User password (min 8 characters)', example: 'strongpassword123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @ApiPropertyOptional({ description: 'User role', default: 'user', enum: ['user', 'agent', 'admin'] })
  @IsOptional()
  @IsString()
  role?: string;
}
