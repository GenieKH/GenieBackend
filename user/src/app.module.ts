import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { ChatModule } from './chat/chat.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    RedisModule,
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
