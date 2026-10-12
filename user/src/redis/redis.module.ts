import { Global, Module } from '@nestjs/common';
import { JsonCache } from './json-cache.service';
import { RateLimits } from './rate-limits.service';
import { RedisConnection } from './redis-connection';

/**
 * One Redis connection for the whole service, used through JsonCache and
 * RateLimits. The connection itself is exported for `RevokedSessions` only.
 */
@Global()
@Module({
  providers: [RedisConnection, JsonCache, RateLimits],
  exports: [RedisConnection, JsonCache, RateLimits],
})
export class RedisModule {}
