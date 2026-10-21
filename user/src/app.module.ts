import { Module } from '@nestjs/common';
import { HealthController, PrismaModule, RedisModule } from '@genie/shared';
import { FollowsModule } from './follows/follows.module';
import { UsersModule } from './users/users.module';

/** The user service: profiles, following, and what happens to an account's content. */
@Module({
  imports: [RedisModule, PrismaModule, UsersModule, FollowsModule],
  controllers: [HealthController],
})
export class AppModule {}
