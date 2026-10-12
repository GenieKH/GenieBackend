import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

/** Names of the image files being uploaded or confirmed. */
export class ImageFileNamesDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  fileNames: string[];
}
