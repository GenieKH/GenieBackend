import { Injectable } from '@nestjs/common';
import { PrismaService } from '@genie/shared';
import { CreateContactDto } from '../dto/create-contact.dto';

/** What users do with someone else's listing: like, favorite, view, contact. */
@Injectable()
export class PropertyEngagementService {
  constructor(private readonly prisma: PrismaService) {}

  like(userId: string, propertyId: string) {
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

  favorite(userId: string, propertyId: string) {
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
    await this.prisma.propertyView.upsert({
      where: { userId_propertyId: { userId, propertyId } },
      create: { userId, propertyId },
      update: {},
    });
    return { success: true };
  }

  contact(userId: string, propertyId: string, dto: CreateContactDto) {
    return this.prisma.propertyContact.create({ data: { ...dto, propertyId, userId } });
  }
}
