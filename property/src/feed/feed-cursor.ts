import { BadRequestException } from '@nestjs/common';

/** Where a feed page ends: the last listing's ranking time and id. */
export interface FeedCursor {
  feedAt: Date;
  id: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Opaque to the app: it only sends back what it was given. A listing
 * published while someone scrolls never shifts the pages after it, as an
 * offset would.
 */
export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(`${cursor.feedAt.toISOString()}|${cursor.id}`).toString(
    'base64url',
  );
}

/** A 400 for anything this service did not hand out. */
export function decodeFeedCursor(raw: string): FeedCursor {
  const [time, id, ...rest] = Buffer.from(raw, 'base64url')
    .toString('utf8')
    .split('|');
  const feedAt = new Date(time ?? '');
  if (rest.length > 0 || !id || !UUID.test(id) || isNaN(feedAt.getTime())) {
    throw new BadRequestException('Invalid cursor');
  }
  return { feedAt, id };
}
