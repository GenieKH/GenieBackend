import { IsNumber, IsNotEmpty } from 'class-validator';

export class PinDto {
  @IsNumber()
  @IsNotEmpty()
  lat: number;

  @IsNumber()
  @IsNotEmpty()
  lng: number;
}
