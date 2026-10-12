import { Injectable } from '@nestjs/common';
import { RedisConnection } from './redis-connection';

/** Written by the authentication service (`RevokedSessionStore`): spelled the same there. */
const KEY_PREFIX = 'sessions:revoked:';

/**
 * The sessions that were signed out while their access token had not expired.
 * A token is valid on its signature alone, so asking here on every request is
 * what makes a sign-out immediate instead of taking up to 15 minutes.
 */
@Injectable()
export class RevokedSessions {
  constructor(private readonly redis: RedisConnection) {}

  async has(sessionId: string): Promise<boolean> {
    try {
      return (await this.redis.client.exists(KEY_PREFIX + sessionId)) === 1;
    } catch {
      // Without Redis the question cannot be answered. Refusing everyone would
      // be an outage of our own making; the token still expires on its own.
      return false;
    }
  }
}
