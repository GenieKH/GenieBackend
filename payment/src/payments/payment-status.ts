/** Lifecycle of a PaymentTransaction row. */
export const PaymentStatus = {
  Pending: 'Pending',
  Success: 'Success',
  Failed: 'Failed',
} as const;

/** Fee charged to publish a listing. Stub value until pricing is decided. */
export const PUBLISH_FEE = 50;
