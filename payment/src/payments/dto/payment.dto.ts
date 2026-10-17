import { IsIn, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  propertyId: string;
}

export class PaymentWebhookDto {
  @IsUUID()
  transactionId: string;

  @IsIn(['SUCCESS', 'FAILED'])
  status: 'SUCCESS' | 'FAILED';

  /** When present it must equal the amount we asked the user to pay. */
  @IsOptional()
  @IsNumber()
  amount?: number;
}
