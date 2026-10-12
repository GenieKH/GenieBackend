import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server, ServerOptions } from 'socket.io';
import { redisUrl } from '../redis/redis-connection';

/**
 * Lets several instances of this service act as one chat server: a message
 * emitted on one instance reaches sockets connected to another, and "who is
 * online" is answered across all of them. Sockets on the same instance keep
 * reaching each other while Redis is unavailable.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
    // These two queue commands while reconnecting, so subscriptions survive an outage.
    this.publisher = new Redis(redisUrl(), { retryStrategy: (attempt) => Math.min(attempt * 500, 5000) });
    this.subscriber = this.publisher.duplicate();
    for (const connection of [this.publisher, this.subscriber]) {
      connection.on('error', (error: Error & { code?: string }) => this.logger.error(`Chat Redis connection error: ${error.message || error.code || 'cannot connect'}`));
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    server.adapter(createAdapter(this.publisher, this.subscriber));
    return server;
  }

  async close(server: Server): Promise<void> {
    await super.close(server);
    this.publisher.disconnect();
    this.subscriber.disconnect();
  }
}
