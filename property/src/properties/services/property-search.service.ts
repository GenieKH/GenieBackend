import { Injectable } from '@nestjs/common';
import { PrismaService } from '@genie/shared';
import { MAP_SELECT, PUBLISHED } from '../property-includes';
import { PropertyEngagementCounts } from './property-engagement-counts.service';
import { PublicPropertyCache } from './public-property-cache.service';

/** Published listings found by what they say or who posted them. */
@Injectable()
export class PropertySearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicCache: PublicPropertyCache,
    private readonly counts: PropertyEngagementCounts,
  ) {}

  /**
   * Published listings whose title or description contains every one of
   * `terms` (already normalized, see `normalizeSearchText`), newest first.
   */
  matching(terms: string[], limit: number) {
    if (terms.length === 0) return Promise.resolve([]);

    return this.publicCache.listings(`text:${limit}:${terms.join(' ')}`, async () =>
      this.counts.attach(
        await this.prisma.property.findMany({
          where: {
            ...PUBLISHED,
            AND: terms.map((term) => ({
              OR: [
                { title: { contains: term, mode: 'insensitive' as const } },
                { description: { contains: term, mode: 'insensitive' as const } },
              ],
            })),
          },
          select: MAP_SELECT,
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      ),
    );
  }

  /** One owner's published listings, newest first. */
  byOwner(ownerId: string, limit: number) {
    return this.publicCache.listings(`owner:${limit}:${ownerId}`, async () =>
      this.counts.attach(
        await this.prisma.property.findMany({
          where: { ...PUBLISHED, userId: ownerId },
          select: MAP_SELECT,
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      ),
    );
  }
}
