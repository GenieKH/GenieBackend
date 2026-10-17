/** The webhook fields every provider adapter must be able to authenticate. */
export interface ProviderWebhook {
  transactionId: string;
  status: string;
}

/** What the payment module needs from an external payment provider (ABA, KHQR, ...). */
export interface PaymentProvider {
  /** Starts a payment and returns the URL the user should open to pay. */
  initiateCheckout(transactionId: string, amount: number): Promise<string>;

  /** True only when the webhook really came from the provider. Must fail closed. */
  verifyWebhook(webhook: ProviderWebhook, signature: string): boolean;
}
