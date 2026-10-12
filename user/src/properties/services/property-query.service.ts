import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OWNER_SUMMARY_SELECT, PROPERTY_WITH_RELATIONS } from '../property-includes';

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/** Read-only property lookups. */
@Injectable()
export class PropertyQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /** All of a user's properties except deleted ones, newest first. */
  findAllForOwner(userId: string) {
    return this.prisma.property.findMany({
      where: { userId, status: { not: 'Deleted' } },
      include: PROPERTY_WITH_RELATIONS,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** One property owned by `userId`; 404 if it is missing, deleted or not theirs. */
  async findOwned(userId: string, id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, userId, status: { not: 'Deleted' } },
      include: PROPERTY_WITH_RELATIONS,
    });
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    return property;
  }

  /** A published property, visible to anyone. */
  async findPublic(id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, status: 'Active' },
      include: PROPERTY_WITH_RELATIONS,
    });
    if (!property) {
      throw new NotFoundException('Property not found or not active');
    }
    return property;
  }

  async listFavorites(userId: string) {
    const favorites = await this.prisma.propertyFavorite.findMany({
      where: { userId },
      include: { property: { include: PROPERTY_WITH_RELATIONS } },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((favorite) => favorite.property);
  }

  /** Published properties inside the map viewport, flagged `isVisited` for `userId`. */
  async searchMap(bounds: MapBounds, userId?: string) {
    const properties = await this.prisma.property.findMany({
      where: {
        status: 'Active',
        lat: { gte: bounds.minLat, lte: bounds.maxLat },
        lng: { gte: bounds.minLng, lte: bounds.maxLng },
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        lat: true,
        lng: true,
        propertyType: true,
        boundaryPoints: true,
        createdAt: true,
        status: true,
        bedrooms: true,
        bathrooms: true,
        landSize: true,
        buildingSize: true,
        unitSize: true,
        images: { orderBy: { order: 'asc' } },
        user: { select: OWNER_SUMMARY_SELECT },
        _count: { select: { favorites: true, contacts: true } },
        views: userId ? { where: { userId } } : false,
      },
    });

    return properties.map(({ views, ...property }) => ({
      ...property,
      isVisited: !!views && views.length > 0,
    }));
  }
}
