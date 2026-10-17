import { Module } from '@nestjs/common';
import { HealthController, JwtStrategy, PrismaModule } from '@genie/shared';
import { PaymentsModule } from './payments/payments.module';

/** The payment service: starts a payment and settles it from the provider's webhook. */
@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [HealthController],
  providers: [JwtStrategy],
})
export class AppModule {}
