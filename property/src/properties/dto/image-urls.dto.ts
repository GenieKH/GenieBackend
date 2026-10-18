import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

/** Public URLs of a listing's photos, as the listing returns them. */
export class ImageUrlsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  urls: string[];
}
