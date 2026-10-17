import { Module } from '@nestjs/common';
import { AbaPaywayProvider } from './aba-payway.provider';
import { PaymentCheckoutService } from './payment-checkout.service';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentsController } from './payments.controller';
import { PropertyPublishingClient } from './property/property-publishing.client';

@Module({
  controllers: [PaymentsController],
  providers: [AbaPaywayProvider, PaymentCheckoutService, PaymentWebhookService, PropertyPublishingClient],
})
export class PaymentsModule {}
