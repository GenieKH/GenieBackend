import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RequestContextMiddleware } from './auth/request-context.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PropertiesModule } from './properties/properties.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';
import { JwtStrategy } from './auth/jwt.strategy';

@Module({
  imports: [PropertiesModule, PaymentsModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}


