import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AbaPaywayProvider } from './aba-payway.provider';
import { PaymentWebhookDto } from './dto/payment.dto';
import { PaymentStatus } from './payment-status';

export interface WebhookResult {
  success: boolean;
  /** True when this transaction had already been settled by an earlier webhook. */
  alreadyProcessed?: boolean;
}

/**
 * Settles a payment from the provider's webhook.
 * Safe to receive the same webhook many times: a transaction is settled once.
 */
@Injectable()
export class PaymentWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AbaPaywayProvider,
  ) {}

  async handle(dto: PaymentWebhookDto, signature: string): Promise<WebhookResult> {
    if (!this.provider.verifyWebhook(dto, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const transaction = await this.prisma.paymentTransaction.findUnique({
      where: { id: dto.transactionId },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (dto.amount !== undefined && !transaction.amount.equals(dto.amount)) {
      throw new BadRequestException('Amount does not match the transaction');
    }

    if (transaction.status !== PaymentStatus.Pending) {
      return { success: transaction.status === PaymentStatus.Success, alreadyProcessed: true };
    }

    return dto.status === 'SUCCESS'
      ? this.settle(transaction.id, transaction.propertyId, PaymentStatus.Success, 'Active')
      : this.settle(transaction.id, transaction.propertyId, PaymentStatus.Failed, 'Draft');
  }

  /**
   * Moves a Pending transaction to its final status and updates the property,
   * atomically. Only one concurrent webhook can win the Pending -> final switch.
   */
  private settle(
    transactionId: string,
    propertyId: string,
    finalStatus: string,
    propertyStatus: string,
  ): Promise<WebhookResult> {
    return this.prisma.$transaction(async (tx) => {
      const switched = await tx.paymentTransaction.updateMany({
        where: { id: transactionId, status: PaymentStatus.Pending },
        data: { status: finalStatus },
      });
      if (switched.count === 0) {
        return { success: false, alreadyProcessed: true };
      }

      await tx.property.updateMany({
        where: { id: propertyId, status: 'Pending' },
        data: { status: propertyStatus },
      });
      return { success: finalStatus === PaymentStatus.Success };
    });
  }
}
