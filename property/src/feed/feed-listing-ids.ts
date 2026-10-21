import { Prisma } from '@genie/prisma-client';
import { PrismaService } from '@genie/shared';
import { FeedCursor } from './feed-cursor';

/** A listing's place in the feed. */
export interface FeedPosition {
  id: string;
  publishedAt: Date;
}

/**
 * The next `take` live listings of `ownerIds` after `after`, newest
 * published first, ties by id. Hidden (deactivated) owners are left out.
 *
 * Each owner's newest `take` are read from the index (owner, published_at,
 * id), then merged: the work is at most owners x `take` index rows however
 * many listings those owners have. A single `user_id IN (...) ORDER BY`
 * would read and sort every live listing of every followed owner.
 */
export async function nextFeedPositions(
  prisma: PrismaService,
  ownerIds: string[],
  take: number,
  after?: FeedCursor,
): Promise<FeedPosition[]> {
  const afterCursor = after
    ? Prisma.sql`AND (published_at < ${after.publishedAt}
         OR (published_at = ${after.publishedAt} AND id > ${after.id}::uuid))`
    : Prisma.empty;

  return prisma.$queryRaw<FeedPosition[]>`
    SELECT p.id::text AS id, p.published_at AS "publishedAt"
    FROM unnest(${ownerIds}::uuid[]) AS f(owner_id)
    JOIN users u ON u.id = f.owner_id AND u.deactivated_at IS NULL
    CROSS JOIN LATERAL (
      SELECT id, published_at
      FROM properties
      WHERE user_id = f.owner_id
        AND status = 'Active'
        AND published_at IS NOT NULL
        ${afterCursor}
      ORDER BY published_at DESC, id ASC
      LIMIT ${take}
    ) p
    ORDER BY p.published_at DESC, p.id ASC
    LIMIT ${take}`;
}
