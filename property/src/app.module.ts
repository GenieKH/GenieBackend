import { Module } from '@nestjs/common';
import {
  HealthController,
  JwtStrategy,
  PrismaModule,
  RedisModule,
} from '@genie/shared';
import { AlertsModule } from './alerts/alerts.module';
import { FeedModule } from './feed/feed.module';
import { PropertiesModule } from './properties/properties.module';
import { SearchModule } from './search/search.module';

/**
 * The property service: listings, their photos and engagement, the home
 * screen's search, the feed, and pushes about listings people care about.
 */
@Module({
  imports: [
    RedisModule,
    PrismaModule,
    PropertiesModule,
    SearchModule,
    FeedModule,
    AlertsModule,
  ],
  controllers: [HealthController],
  providers: [JwtStrategy],
})
export class AppModule {}
