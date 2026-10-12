import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { ChatModule } from './chat/chat.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
      store: require('cache-manager-redis-yet').redisStore,
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: 300000, // 5 minutes
    }),
    PrismaModule,
    PropertiesModule,
    PaymentsModule,
    UsersModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService, JwtStrategy],
})
export class AppModule {}
