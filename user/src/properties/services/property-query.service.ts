import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OWNER_SUMMARY_SELECT, PROPERTY_WITH_RELATIONS } from '../property-includes';
import { MapBounds, PublicPropertyCache, widenToGrid } from './public-property-cache.service';

/** What the map shows of a listing. The same for every visitor, so it can be cached. */
const MAP_SELECT = {
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
} as const;

/** What strangers may see: published listings of accounts that are not deactivated. */
const PUBLISHED = { status: 'Active', user: { deactivatedAt: null } } as const;

/** Read-only property lookups. */
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

  /** Saved listings. One whose owner deactivated their account is left out until they return. */
  async listFavorites(userId: string) {
    const favorites = await this.prisma.propertyFavorite.findMany({
      where: { userId, property: { user: { deactivatedAt: null } } },
      include: { property: { include: PROPERTY_WITH_RELATIONS } },
      orderBy: { createdAt: 'desc' },
    });
    return favorites.map((favorite) => favorite.property);
  }

  /**
   * Published properties in (slightly more than) the map viewport, flagged
   * `isVisited` for `userId`. The list is shared by everyone looking at that
   * area; only the flag is looked up per user.
   */
  async searchMap(bounds: MapBounds, userId?: string) {
    const box = widenToGrid(bounds);
    const properties = await this.publicCache.map(box, () =>
      this.prisma.property.findMany({
        where: {
          ...PUBLISHED,
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
        },
        select: MAP_SELECT,
      }),
    );

    const visited = await this.visitedAmong(
      userId,
      properties.map((property) => property.id),
    );
    return properties.map((property) => ({ ...property, isVisited: visited.has(property.id) }));
  }

  private async visitedAmong(userId: string | undefined, propertyIds: string[]): Promise<Set<string>> {
    if (!userId || propertyIds.length === 0) return new Set();

    const views = await this.prisma.propertyView.findMany({
      where: { userId, propertyId: { in: propertyIds } },
      select: { propertyId: true },
    });
    return new Set(views.map((view) => view.propertyId));
  }
}
