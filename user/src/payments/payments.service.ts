import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AbaPaywayProvider } from './aba-payway.provider';
import { PropertyStatusService } from '../properties/property-status.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abaPayway: AbaPaywayProvider,
    private readonly statusService: PropertyStatusService,
  ) {}

  async initiateCheckout(userId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');

    // Make sure we can publish it (must be Draft or Expired)
    this.statusService.canPublish(property.status);

    // Set status to Pending
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { status: 'Pending' },
    });

    const amount = 50.00; // Flat fee stub
    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        userId,
        propertyId,
        provider: 'ABA_PAYWAY',
        amount,
        status: 'Pending',
      }
    });

    const checkoutUrl = await this.abaPayway.initiateCheckout(transaction.id, amount);
    return { checkoutUrl, transactionId: transaction.id };
  }

  async handleWebhook(payload: any, signature: string) {
    const isValid = this.abaPayway.verifyWebhook(payload, signature);
    if (!isValid) throw new BadRequestException('Invalid webhook signature');

    const transactionId = payload.transactionId;
    const status = payload.status; // e.g., 'SUCCESS'

    const transaction = await this.prisma.paymentTransaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundException('Transaction not found');

    if (status === 'SUCCESS') {
      await this.prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.update({
          where: { id: transactionId },
          data: { status: 'Success' },
        });

        // Finally, the stub gets payment-gated: Pending -> Published
        await tx.property.update({
          where: { id: transaction.propertyId },
          data: { status: 'Active' },
        });
      });
      return { success: true };
    }

    // Handle failure
    await this.prisma.paymentTransaction.update({
      where: { id: transactionId },
      data: { status: 'Failed' },
    });

    return { success: false };
  }
}
