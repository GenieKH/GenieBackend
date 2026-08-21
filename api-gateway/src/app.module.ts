import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AuthMiddleware } from './auth.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 1. Proxies that DO NOT require JWT validation (Auth service)
    consumer
      .apply(
        createProxyMiddleware({
          target: 'http://localhost:3000',
          changeOrigin: true,
        }),
      )
      .forRoutes({ path: '/auth/*', method: RequestMethod.ALL });

    // 2. Proxies that DO NOT require JWT validation (Public properties)
    consumer
      .apply(
        createProxyMiddleware({
          target: 'http://localhost:3001',
          changeOrigin: true,
        }),
      )
      .forRoutes({ path: '/public/*', method: RequestMethod.ALL });

    // 3. Proxies that REQUIRE JWT validation (User service)
    // First apply AuthMiddleware to extract x-user-id, then proxy to user service
    consumer
      .apply(
        AuthMiddleware,
        createProxyMiddleware({
          target: 'http://localhost:3001',
          changeOrigin: true,
          on: {
            proxyReq: (proxyReq, req: any, res) => {
              // Ensure the x-user-id header is forwarded securely
              if (req.headers['x-user-id']) {
                proxyReq.setHeader('x-user-id', req.headers['x-user-id']);
              }
            },
          },
        }),
      )
      .forRoutes(
        { path: '/properties/*', method: RequestMethod.ALL },
        { path: '/payments/*', method: RequestMethod.ALL },
        { path: '/users/*', method: RequestMethod.ALL }
      );
  }
}
