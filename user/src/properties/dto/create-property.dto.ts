import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  BUILDING_TYPES,
  COMPLETION_STATUSES,
  DISCOUNT_TYPES,
  FURNISHINGS,
  KEYWORDS,
  LISTING_TYPES,
  MAX_KEYWORDS,
  PROJECT_TYPES,
  PROPERTY_TYPES,
  TITLE_TYPES,
  VIEW_TYPES,
} from '../property-options';

/**
 * A new listing. Every detail is optional here: a draft may be saved half
 * filled. Details that do not belong to `propertyType` are dropped by the
 * service (see property-type-fields.ts).
 */
export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsIn(PROPERTY_TYPES)
  propertyType: string;

  /** With `discountValue`: a percentage of the price, or USD off it. */
  @IsIn(DISCOUNT_TYPES)
  @IsOptional()
  discountType?: string | null;

  @IsNumber()
  @IsOptional()
  discountValue?: number | null;

  @IsIn(LISTING_TYPES)
  @IsOptional()
  listingType?: string;

  @IsIn(TITLE_TYPES)
  @IsOptional()
  titleType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  contactPhone?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  bedrooms?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  bathrooms?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  landSize?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  buildingSize?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  unitSize?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalProjectArea?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  floors?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  floorNumber?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  totalUnits?: number;

  @IsBoolean()
  @IsOptional()
  hasParking?: boolean;

  @IsBoolean()
  @IsOptional()
  hasBalcony?: boolean;

  @IsIn(FURNISHINGS)
  @IsOptional()
  furnishing?: string;

  @IsIn(BUILDING_TYPES)
  @IsOptional()
  buildingType?: string;

  @IsIn(COMPLETION_STATUSES)
  @IsOptional()
  completionStatus?: string;

  @IsIn(VIEW_TYPES)
  @IsOptional()
  viewType?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maintenanceFee?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  developerName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  projectName?: string;

  @IsIn(PROJECT_TYPES)
  @IsOptional()
  projectType?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyRent?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  leaseRemainingMonths?: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  equipmentIncluded?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reasonForSelling?: string;

  /** Keyword codes (see KEYWORDS). On update, the list replaces the old one. */
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(MAX_KEYWORDS)
  @IsIn(KEYWORDS, { each: true })
  @IsOptional()
  keywords?: string[];

  @IsString()
  @IsOptional()
  status?: string;
}
