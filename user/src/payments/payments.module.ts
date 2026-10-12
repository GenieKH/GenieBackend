import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module';
import { AbaPaywayProvider } from './aba-payway.provider';
import { PaymentCheckoutService } from './payment-checkout.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [PropertiesModule],
  controllers: [PaymentsController],
  providers: [AbaPaywayProvider, PaymentCheckoutService, PaymentWebhookService],
})
export class PaymentsModule {}
