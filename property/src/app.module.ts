import { Module } from '@nestjs/common';
import {
  HealthController,
  JwtStrategy,
  PrismaModule,
  RedisModule,
} from '@genie/shared';
import { FeedModule } from './feed/feed.module';
import { PropertiesModule } from './properties/properties.module';
import { SearchModule } from './search/search.module';

/** The property service: listings, their photos and engagement, the home screen's search, and the feed. */
@Module({
  imports: [
    RedisModule,
    PrismaModule,
    PropertiesModule,
    SearchModule,
    FeedModule,
  ],
  controllers: [HealthController],
  providers: [JwtStrategy],
})
export class AppModule {}
