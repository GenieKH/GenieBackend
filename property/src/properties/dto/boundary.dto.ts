import { IsArray } from 'class-validator';

/** The drawn land boundary: a list of `{ lat, lng }` points. */
export class BoundaryDto {
  @IsArray()
  boundaryPoints: Array<{ lat: number; lng: number }>;
}
