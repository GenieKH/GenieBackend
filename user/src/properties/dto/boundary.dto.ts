import { IsObject, IsNotEmpty } from 'class-validator';

export class BoundaryDto {
  @IsObject()
  @IsNotEmpty()
  boundaryPoints: any;
}
