import { IsEmail, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
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

  @ApiProperty({ description: 'User password', example: 'strongpassword123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
