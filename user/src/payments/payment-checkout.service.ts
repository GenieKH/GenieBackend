import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PropertyStatusService } from '../properties/property-status.service';
import { PropertyQueryService } from '../properties/services/property-query.service';
import { AbaPaywayProvider } from './aba-payway.provider';
import { PaymentStatus, PUBLISH_FEE } from './payment-status';

/** Starts the payment that publishes a listing. */
@Injectable()
export class PaymentCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AbaPaywayProvider,
    private readonly properties: PropertyQueryService,
    private readonly propertyStatus: PropertyStatusService,
  ) {}

  async initiate(userId: string, propertyId: string) {
    // Only the owner may pay to publish, and only from a publishable status.
    const property = await this.properties.findOwned(userId, propertyId);
    this.propertyStatus.canPublish(property.status);

    const transaction = await this.prisma.$transaction(async (tx) => {
      await tx.property.update({ where: { id: propertyId }, data: { status: 'Pending' } });
      return tx.paymentTransaction.create({
        data: {
          userId,
          propertyId,
          provider: 'ABA_PAYWAY',
          amount: PUBLISH_FEE,
          status: PaymentStatus.Pending,
        },
      });
    });

    const checkoutUrl = await this.provider.initiateCheckout(transaction.id, PUBLISH_FEE);
    return { checkoutUrl, transactionId: transaction.id };
  }
}
