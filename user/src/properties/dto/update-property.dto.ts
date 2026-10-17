import { OmitType, PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { PROPERTY_TYPES } from '../property-options';
import { CreatePropertyDto } from './create-property.dto';

/** Validates the field when it is sent, `null` included (which then fails). */
const IfSent = () => ValidateIf((_, value) => value !== undefined);

/**
 * Any listing detail, the type included. A field left out stays as it is;
 * `null` clears it, except for the title, price and type, which every
 * listing must have. Status changes go through their own endpoints.
 */
export class UpdatePropertyDto extends PartialType(
  OmitType(CreatePropertyDto, ['status', 'title', 'price', 'propertyType'] as const),
) {
  @IfSent()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IfSent()
  @IsNumber()
  @Min(0)
  price?: number;

  @IfSent()
  @IsIn(PROPERTY_TYPES)
  propertyType?: string;
}
