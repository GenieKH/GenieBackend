import { IsOptional, IsString } from 'class-validator';

export class GuestSessionDto {
  @IsOptional()
  @IsString()
  deviceId?: string;
}
