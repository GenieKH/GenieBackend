import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

/** Names of the image files being uploaded or confirmed. */
export class ImageFileNamesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  fileNames: string[];
}
