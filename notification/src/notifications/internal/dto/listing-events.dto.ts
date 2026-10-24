import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** The most people one call may name; the property service sends more in several calls. */
export const MAX_RECIPIENTS = 500;

/** A title long enough to recognise; a push shows less anyway. */
const MAX_TITLE_LENGTH = 200;

/** One person whose saved search a listing matched. */
export class SavedSearchRecipientDto {
  @IsUUID()
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  searchName: string;
}

/** From property: a listing went live that these people's saved searches would show. */
export class SavedSearchMatchEventDto {
  @IsUUID()
  propertyId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TITLE_LENGTH)
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_RECIPIENTS)
  @ValidateNested({ each: true })
  @Type(() => SavedSearchRecipientDto)
  recipients: SavedSearchRecipientDto[];
}
