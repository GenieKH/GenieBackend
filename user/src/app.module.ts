import { Module } from '@nestjs/common';
import { HealthController, PrismaModule, RedisModule } from '@genie/shared';
import { UsersModule } from './users/users.module';

/** The user service: profiles and what happens to an account's content. */
@Module({
  imports: [RedisModule, PrismaModule, UsersModule],
  controllers: [HealthController],
})
export class AppModule {}
