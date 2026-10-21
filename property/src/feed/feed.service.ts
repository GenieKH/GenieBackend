import { Injectable } from '@nestjs/common';
import { Prisma } from '@genie/prisma-client';
import { PrismaService } from '@genie/shared';
import { FEED_CARD_SELECT } from './feed-card.select';
import { FeedCursor, encodeFeedCursor } from './feed-cursor';
import { nextFeedPositions } from './feed-listing-ids';
import { FollowedAccounts } from './followed-accounts';

type FeedCard = Prisma.PropertyGetPayload<{ select: typeof FEED_CARD_SELECT }>;

/** One page of the feed, and the cursor of the next (null after the last). */
export interface FeedPage {
  items: FeedCard[];
  nextCursor: string | null;
}

/**
 * The feed: live listings of the people a user follows, most recently
 * published first. Read when asked (no stored feed): a user follows at most
 * 500 people, and the page is found from each one's newest listings. A
 * listing whose owner deactivated their account is left out until they
 * return.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly followed: FollowedAccounts,
  ) {}

  async page(
    userId: string,
    page: { limit: number; after?: FeedCursor },
  ): Promise<FeedPage> {
    const ownerIds = await this.followed.idsFollowedBy(userId);
    if (ownerIds.length === 0) return { items: [], nextCursor: null };

    // One more than the page: it only tells that there is another page.
    const positions = await nextFeedPositions(
      this.prisma,
      ownerIds,
      page.limit + 1,
      page.after,
    );
    const shown = positions.slice(0, page.limit);
    const last = shown[shown.length - 1];

    return {
      items: await this.cards(shown.map((position) => position.id)),
      // From the positions, not the cards: a listing sold in between leaves
      // the page one short, never the next page shifted.
      nextCursor:
        positions.length > page.limit && last
          ? encodeFeedCursor({ publishedAt: last.publishedAt, id: last.id })
          : null,
    };
  }

  /** The cards of `ids`, in that order; one no longer live is left out. */
  private async cards(ids: string[]): Promise<FeedCard[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.property.findMany({
      where: { id: { in: ids }, status: 'Active' },
      select: FEED_CARD_SELECT,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }
}
