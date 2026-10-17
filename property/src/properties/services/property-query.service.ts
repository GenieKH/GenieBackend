import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@genie/shared';
import {
  MAP_SELECT,
  PROPERTY_WITH_RELATIONS,
  PUBLISHED,
} from '../property-includes';
import {
  MapBounds,
  MapFilter,
  PublicPropertyCache,
  widenToGrid,
} from './public-property-cache.service';

/** Read-only property lookups. */
/** The most listings one map search returns: the newest ones in the area. */
export const MAP_RESULT_LIMIT = 500;

/** Statuses a saved listing is hidden in: the owner has not published it, or removed it. */
const HIDDEN_STATUSES = ['Draft', 'Pending', 'Deleted'];

@Injectable()
export class PropertyQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicCache: PublicPropertyCache,
  ) {}

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
  findPublic(id: string) {
    return this.publicCache.detail(id, async () => {
      const property = await this.prisma.property.findFirst({
        where: { id, ...PUBLISHED },
        include: PROPERTY_WITH_RELATIONS,
      });
      if (!property) {
        throw new NotFoundException('Property not found or not active');
      }
      return property;
    });
  }

  /**
   * Saved listings. One whose owner deactivated their account is left out until they return,
   * and so is one its owner took back to a draft or deleted since it was saved.
   */
  async listFavorites(userId: string) {
    const favorites = await this.prisma.propertyFavorite.findMany({
      where: { userId, property: { user: { deactivatedAt: null }, status: { notIn: HIDDEN_STATUSES } } },
      include: { property: { include: PROPERTY_WITH_RELATIONS } },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((favorite) => favorite.property);
  }

  /**
   * Published properties in (slightly more than) the map viewport, flagged
   * `isVisited` for `userId`. The list is shared by everyone looking at that
   * area and `filter`; only the flag is looked up per user.
   */
  async searchMap(bounds: MapBounds, userId?: string, filter: MapFilter = {}) {
    if (bounds.minLat > bounds.maxLat || bounds.minLng > bounds.maxLng) {
      throw new BadRequestException('The map bounds are the wrong way round');
    }
    const box = widenToGrid(bounds);
    const properties = await this.publicCache.map(box, filter, () =>
      this.prisma.property.findMany({
        where: {
          ...PUBLISHED,
          ...(filter.propertyType && { propertyType: filter.propertyType }),
          ...(filter.listingType && { listingType: filter.listingType }),
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
        },
        select: MAP_SELECT,
        // A zoomed-out map would otherwise receive every listing there is.
        orderBy: { createdAt: 'desc' },
        take: MAP_RESULT_LIMIT,
      }),
    );

    const visited = await this.visitedAmong(
      userId,
      properties.map((property) => property.id),
    );
    return properties.map((property) => ({
      ...property,
      isVisited: visited.has(property.id),
    }));
  }

  private async visitedAmong(
    userId: string | undefined,
    propertyIds: string[],
  ): Promise<Set<string>> {
    if (!userId || propertyIds.length === 0) return new Set();

    const views = await this.prisma.propertyView.findMany({
      where: { userId, propertyId: { in: propertyIds } },
      select: { propertyId: true },
    });
    return new Set(views.map((view) => view.propertyId));
  }
}
