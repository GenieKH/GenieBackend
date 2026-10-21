import { Injectable } from '@nestjs/common';
import { PrismaService } from '@genie/shared';
import { PropertyStatusService } from '../property-status.service';
import { PropertyQueryService } from './property-query.service';
import { ListingChanges } from './listing-changes.service';
import { CACHED_LISTING_SELECT } from './public-property-cache.service';

/** How a payment ended, as far as the listing is concerned. */
export type PublishOutcome = 'Active' | 'Draft';

/**
 * The listing's side of paying to publish. The payment service owns the money
 * and decides when a payment is settled; this service owns the listing's
 * status, so every status change still goes through its rules.
 */
@Injectable()
export class PropertyPublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly query: PropertyQueryService,
    private readonly status: PropertyStatusService,
    private readonly listingChanges: ListingChanges,
  ) {}

  /**
   * A payment to publish is starting: only the owner may pay, and only from a
   * publishable status. The listing waits as Pending. Answers the status it
   * had, so the payment service can put it back if it cannot go on.
   */
  async beginPublish(
    userId: string,
    propertyId: string,
  ): Promise<{ previousStatus: string }> {
    const property = await this.query.findOwned(userId, propertyId);
    this.status.canPublish(property.status);

    await this.prisma.property.update({
      where: { id: propertyId },
      data: { status: 'Pending' },
    });
    return { previousStatus: property.status };
  }

  /**
   * The payment ended: a paid listing goes live, an unpaid one goes back to
   * Draft. Only a Pending listing changes, so repeating the call is harmless.
   */
  async settlePublish(
    propertyId: string,
    outcome: PublishOutcome,
  ): Promise<void> {
    const { count } = await this.prisma.property.updateMany({
      where: { id: propertyId, status: 'Pending' },
      data: {
        status: outcome,
        ...(outcome === 'Active' && { publishedAt: new Date() }),
      },
    });
    // The listing just went live: let the map show it without waiting for the cache to expire.
    if (outcome === 'Active' && count > 0) {
      const listing = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: CACHED_LISTING_SELECT,
      });
      if (listing) await this.listingChanges.changed(listing);
    }
  }

  /** The payment could not be started: the listing returns to the status it had. */
  async revertPublish(propertyId: string, status: string): Promise<void> {
    await this.prisma.property.updateMany({
      where: { id: propertyId, status: 'Pending' },
      data: { status },
    });
  }
}
