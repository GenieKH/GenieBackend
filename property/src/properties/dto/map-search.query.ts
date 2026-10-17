import { IsIn, IsOptional } from 'class-validator';
import { LISTING_TYPES, PROPERTY_TYPES } from '../property-options';
import { MapBoundsQuery } from './map-bounds.query';

/** The visible map rectangle plus the filter pills under the search bar. */
export class MapSearchQuery extends MapBoundsQuery {
  @IsIn(PROPERTY_TYPES)
  @IsOptional()
  propertyType?: string;

  @IsIn(LISTING_TYPES)
  @IsOptional()
  listingType?: string;
}
