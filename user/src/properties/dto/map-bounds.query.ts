import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

/** Visible map rectangle, sent as query-string numbers. */
export class MapBoundsQuery {
  @Type(() => Number)
  @IsNumber()
  minLat: number;

  @Type(() => Number)
  @IsNumber()
  maxLat: number;

  @Type(() => Number)
  @IsNumber()
  minLng: number;

  @Type(() => Number)
  @IsNumber()
  maxLng: number;
}
