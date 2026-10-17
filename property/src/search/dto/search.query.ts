import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const SEARCH_LANGUAGES = ['en', 'km'] as const;

/** A token the app makes per search (a UUID fits), see `PlaceLookupOptions.sessionToken`. */
const SESSION_TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

/** Shared by every search request. */
export class PlaceSessionQuery {
  @IsOptional()
  @Matches(SESSION_TOKEN)
  session?: string;

  @IsOptional()
  @IsIn(SEARCH_LANGUAGES)
  lang?: (typeof SEARCH_LANGUAGES)[number];
}

/** `GET /public/search`. `q` is normalized and cut to 80 characters by the service. */
export class SearchQuery extends PlaceSessionQuery {
  @IsString()
  @Length(1, 200)
  q: string;

  /** The map's centre: places near it are suggested first. Both or neither. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

/** `GET /public/search/places/:placeId` */
export class PlaceIdParam {
  @Matches(/^[A-Za-z0-9_-]{10,512}$/)
  placeId: string;
}
