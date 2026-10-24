import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SentryErrorsModule } from '@genie/shared/sentry';
import { AppController } from './app.controller';
import { AuthMiddleware } from './auth.middleware';
import {
  createRateLimitMiddleware,
  createRequestLimiter,
} from './rate-limit.middleware';
import { RedisConnection } from './redis-connection';
import { RevokedSessions } from './revoked-sessions';
import { createServiceProxy, WebSocketProxy } from './service-proxy';
import {
  routesFor,
  SERVICE_ROUTES,
  serviceUrlsFromEnv,
} from './service-routes';

@Module({
  imports: [SentryErrorsModule],
  controllers: [AppController],
  providers: [RedisConnection, RevokedSessions],
})
export class AppModule implements NestModule {
  /**
   * The proxies that carry WebSockets. A proxy only starts listening for
   * upgrades after its first HTTP request, so main.ts attaches them to the
   * server at start: chat must work on a gateway that was just restarted.
   */
  readonly websocketProxies: WebSocketProxy[] = [];

  constructor(private readonly redis: RedisConnection) {}

  configure(consumer: MiddlewareConsumer) {
    const urls = serviceUrlsFromEnv();

    // 300 requests a minute per client address, counted before any proxy runs.
    const rateLimit = createRateLimitMiddleware(
      createRequestLimiter(this.redis.client, 300, 60),
    );

    for (const route of SERVICE_ROUTES) {
      const proxy = createServiceProxy(route.service, urls[route.service], {
        authenticated: route.authenticated,
        websocket: route.websocket,
      });
      if (route.websocket) this.websocketProxies.push(proxy);
      const middleware = route.authenticated
        ? [rateLimit, AuthMiddleware, proxy]
        : [rateLimit, proxy];
      const forRoutes = [
        ...routesFor(route.prefixes),
        ...(route.alsoPublic ?? []),
      ];

      const configured = consumer.apply(...middleware);
      (route.exclude
        ? configured.exclude(...route.exclude)
        : configured
      ).forRoutes(...forRoutes);
    }
  }
}
