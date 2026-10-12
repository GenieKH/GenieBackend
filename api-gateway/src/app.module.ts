import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthMiddleware } from './auth.middleware';
import { createRateLimitMiddleware } from './rate-limit.middleware';
import { createServiceProxy } from './service-proxy';

/** Routes forwarded to a service, each as `/x` and `/x/...`. */
const AUTH_PREFIXES = ['/auth'];
const PUBLIC_USER_PREFIXES = ['/public'];
const PROTECTED_USER_PREFIXES = ['/properties', '/payments', '/users', '/chat'];

/** Called by the payment provider, so it cannot carry a user JWT. */
const PAYMENT_WEBHOOK = { path: '/payments/webhook', method: RequestMethod.POST };

function routesFor(prefixes: string[]) {
  return prefixes.flatMap((prefix) => [
    { path: prefix, method: RequestMethod.ALL },
    { path: `${prefix}/{*path}`, method: RequestMethod.ALL },
  ]);
}

@Module({ controllers: [AppController] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4001';
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:4002';

    // 300 requests a minute per client address, counted before any proxy runs.
    const rateLimit = createRateLimitMiddleware({ limit: 300, windowMs: 60_000 });

    // Login, register, refresh, password reset: no JWT yet.
    consumer
      .apply(rateLimit, createServiceProxy(authServiceUrl, { authenticated: false }))
      .forRoutes(...routesFor(AUTH_PREFIXES));

    // Public browsing and the payment provider's webhook: no JWT.
    consumer
      .apply(rateLimit, createServiceProxy(userServiceUrl, { authenticated: false }))
      .forRoutes(...routesFor(PUBLIC_USER_PREFIXES), PAYMENT_WEBHOOK);

    // Everything else needs a valid JWT; AuthMiddleware sets `x-user-id` from it.
    consumer
      .apply(rateLimit, AuthMiddleware, createServiceProxy(userServiceUrl, { authenticated: true }))
      .exclude(PAYMENT_WEBHOOK)
      .forRoutes(...routesFor(PROTECTED_USER_PREFIXES));
  }
}
