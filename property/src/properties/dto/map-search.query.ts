import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { KEYWORDS, LISTING_TYPES, PROPERTY_TYPES } from '../property-options';
import { MapFilter } from '../map-filter';
import { MapBoundsQuery } from './map-bounds.query';
import { MAX_AREA, MAX_MONEY } from './numeric-limits';

/** `?x=a` and `?x=a&x=b` both arrive as a list. */
const asList = ({ value }: { value: unknown }) =>
  value == null ? undefined : Array.isArray(value) ? value : [value];

/** The visible map rectangle plus the map filter. */
export class MapSearchQuery extends MapBoundsQuery {
  @IsIn(PROPERTY_TYPES)
  @IsOptional()
  propertyType?: string;

  /** One or more; older app builds send just one. */
  @Transform(asList)
  @IsArray()
  @IsIn(LISTING_TYPES, { each: true })
  @ArrayMaxSize(LISTING_TYPES.length)
  @IsOptional()
  listingType?: string[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  @IsOptional()
  minPrice?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  @IsOptional()
  maxPrice?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_AREA)
  @IsOptional()
  minSize?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_AREA)
  @IsOptional()
  maxSize?: number;

  @Transform(asList)
  @IsArray()
  @IsIn(KEYWORDS, { each: true })
  @ArrayMaxSize(KEYWORDS.length)
  @IsOptional()
  keyword?: string[];

  /** The filter part, for the services. */
  filter(): MapFilter {
    return {
      propertyType: this.propertyType,
      listingTypes: this.listingType,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      minSize: this.minSize,
      maxSize: this.maxSize,
      keywords: this.keyword,
    };
  }

  /** The rectangle part. */
  bounds() {
    return {
      minLat: this.minLat,
      maxLat: this.maxLat,
      minLng: this.minLng,
      maxLng: this.maxLng,
    };
  }
}
