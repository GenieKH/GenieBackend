import { Injectable } from '@nestjs/common';
import { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class AbaPaywayProvider implements PaymentProvider {
  async initiateCheckout(transactionId: string, amount: number): Promise<string> {
    // In a real scenario, this would call ABA Payway API and get a checkout URL
    return `https://payway.aba.com/checkout?id=${transactionId}&amount=${amount}`;
  }

  verifyWebhook(payload: any, signature: string): boolean {
    // Stub for crypto validation
    // e.g., compute HMAC of payload using merchant secret and compare to signature
    return true; 
  }
}
