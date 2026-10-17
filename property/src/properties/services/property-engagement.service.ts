import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, RateLimit, RateLimits } from '@genie/shared';
import { CreateContactDto } from '../dto/create-contact.dto';
import { PUBLISHED } from '../property-includes';

/** Messages to listing owners one account may send: 10 every 10 minutes. */
const CONTACT_LIMIT = 10;
const CONTACT_WINDOW_SECONDS = 10 * 60;

/** What users do with someone else's listing: like, favorite, view, contact. */
@Injectable()
export class PropertyEngagementService {
  private readonly contactLimiter: RateLimit;

  constructor(
    private readonly prisma: PrismaService,
    rateLimits: RateLimits,
  ) {
    this.contactLimiter = rateLimits.create('property-contact', CONTACT_LIMIT, CONTACT_WINDOW_SECONDS);
  }

  async like(userId: string, propertyId: string) {
    await this.assertVisible(propertyId);
    return this.prisma.propertyLike.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {},
    });
  }

  async unlike(userId: string, propertyId: string) {
    await this.prisma.propertyLike.deleteMany({ where: { userId, propertyId } });
    return { success: true };
  }

  async favorite(userId: string, propertyId: string) {
    await this.assertVisible(propertyId);
    return this.prisma.propertyFavorite.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {},
    });
  }

  async unfavorite(userId: string, propertyId: string) {
    await this.prisma.propertyFavorite.deleteMany({ where: { userId, propertyId } });
    return { success: true };
  }

  async logView(userId: string, propertyId: string) {
    await this.assertVisible(propertyId);
    await this.prisma.propertyView.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {},
    });
    return { success: true };
  }

  async contact(userId: string, propertyId: string, dto: CreateContactDto) {
    await this.assertVisible(propertyId);
    try {
      await this.contactLimiter.consume(userId);
    } catch {
      throw new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.prisma.propertyContact.create({ data: { ...dto, propertyId, userId } });
  }

  /** Strangers can only act on a published listing: a draft or deleted one is "not found" to them. */
  private async assertVisible(propertyId: string): Promise<void> {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ...PUBLISHED },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException('Property not found or not active');
    }
  }
}
