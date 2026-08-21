import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsNotEmpty()
  propertyType: string;

  @IsNumber()
  @IsOptional()
  bedrooms?: number;

  @IsNumber()
  @IsOptional()
  bathrooms?: number;

  @IsNumber()
  @IsOptional()
  landSize?: number;

  @IsNumber()
  @IsOptional()
  buildingSize?: number;

  @IsNumber()
  @IsOptional()
  unitSize?: number;

  @IsNumber()
  @IsOptional()
  totalProjectArea?: number;

  @IsString()
  @IsOptional()
  status?: string;
}
