import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
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
          on: {
            proxyReq: fixRequestBody,
          },
        }),
      )
      .forRoutes(
        { path: '/auth', method: RequestMethod.ALL },
        { path: '/auth/{*path}', method: RequestMethod.ALL }
      );

    // 2. Proxies that DO NOT require JWT validation (Public properties)
    consumer
      .apply(
        createProxyMiddleware({
          target: 'http://localhost:3001',
          changeOrigin: true,
          on: {
            proxyReq: fixRequestBody,
          },
        }),
      )
      .forRoutes(
        { path: '/public', method: RequestMethod.ALL },
        { path: '/public/{*path}', method: RequestMethod.ALL }
      );

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
              // Fix body parser hanging issue
              fixRequestBody(proxyReq, req);
            },
          },
        }),
      )
      .forRoutes(
        { path: '/properties', method: RequestMethod.ALL },
        { path: '/properties/{*path}', method: RequestMethod.ALL },
        { path: '/payments', method: RequestMethod.ALL },
        { path: '/payments/{*path}', method: RequestMethod.ALL },
        { path: '/users', method: RequestMethod.ALL },
        { path: '/users/{*path}', method: RequestMethod.ALL }
      );
  }
}
