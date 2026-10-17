import { Module } from '@nestjs/common';
import { HealthController, JwtStrategy, PrismaModule, RedisModule } from '@genie/shared';
import { PropertiesModule } from './properties/properties.module';
import { SearchModule } from './search/search.module';

/** The property service: listings, their photos and engagement, and the home screen's search. */
@Module({
  imports: [RedisModule, PrismaModule, PropertiesModule, SearchModule],
  controllers: [HealthController],
  providers: [JwtStrategy],
})
export class AppModule {}
