import { Controller, Get, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '@genie/shared';
import { FeedQuery } from './dto/feed.query';
import { decodeFeedCursor } from './feed-cursor';
import { FeedService } from './feed.service';

/** Listings when no `limit` is asked for. */
const DEFAULT_PAGE_SIZE = 20;

@ApiTags('feed')
@ApiHeader({ name: 'x-user-id', description: 'User ID from API Gateway' })
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  /** `{ items, nextCursor }`; send `nextCursor` back as `cursor` for the next page. */
  @Get()
  @ApiOperation({
    summary: 'Live listings of the people you follow, newest published first',
  })
  page(@CurrentUserId() userId: string, @Query() query: FeedQuery) {
    return this.feed.page(userId, {
      limit: query.limit ?? DEFAULT_PAGE_SIZE,
      after:
        query.cursor === undefined ? undefined : decodeFeedCursor(query.cursor),
    });
  }
}
