import { Module } from '@nestjs/common';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { InternalFollowsController } from './internal-follows.controller';

/** Who follows whom: the counts on profiles, and whose listings fill the feed. */
@Module({
  controllers: [FollowsController, InternalFollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
