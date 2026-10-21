import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_PAGE_SIZE } from '../../properties/dto/page.query';

/** One page of the feed: `limit` listings after `cursor` (from the start without one). */
export class FeedQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @IsOptional()
  limit?: number;

  /** `nextCursor` of the page before, exactly as received. */
  @IsString()
  @MaxLength(200)
  @IsOptional()
  cursor?: string;
}
