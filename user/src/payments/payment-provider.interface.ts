export interface PaymentProvider {
  initiateCheckout(transactionId: string, amount: number): Promise<string>;
  verifyWebhook(payload: any, signature: string): boolean;
}
