import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH } from '../search-text';

/** `POST /search/history` */
export class RecordSearchDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(MIN_SEARCH_LENGTH, MAX_SEARCH_LENGTH)
  query: string;
}
