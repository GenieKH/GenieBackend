import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PropertiesModule } from './properties/properties.module';
import { PaymentsModule } from './payments/payments.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PropertiesModule, PaymentsModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
