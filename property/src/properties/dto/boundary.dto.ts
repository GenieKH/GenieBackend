import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { PinDto } from './pin.dto';

/** More corners than any drawn plot needs; stops a huge array from being stored and re-read on every map load. */
export const MAX_BOUNDARY_POINTS = 500;

/** The drawn land boundary: a list of `{ lat, lng }` points. */
export class BoundaryDto {
  @IsArray()
  @ArrayMaxSize(MAX_BOUNDARY_POINTS)
  @ValidateNested({ each: true })
  @Type(() => PinDto)
  boundaryPoints: PinDto[];
}
