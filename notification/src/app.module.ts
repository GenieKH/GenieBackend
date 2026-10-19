import { Module } from '@nestjs/common';
import { HealthController, JwtStrategy, PrismaModule, RedisModule } from '@genie/shared';
import { NotificationsModule } from './notifications/notifications.module';

/** The notification service: push devices, preferences, alerts from other services, promotions. */
@Module({
  imports: [RedisModule, PrismaModule, NotificationsModule],
  controllers: [HealthController],
  providers: [JwtStrategy],
})
export class AppModule {}
