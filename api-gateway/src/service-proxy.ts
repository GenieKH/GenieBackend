import { fixRequestBody, createProxyMiddleware } from 'http-proxy-middleware';
import type { IncomingMessage } from 'http';

/**
 * Builds a reverse proxy to one of the internal services.
 *
 * `x-user-id` is how services learn who is calling, so it must only ever be
 * set by our own AuthMiddleware after verifying a JWT:
 * - public routes strip it, so a client cannot pretend to be someone else;
 * - authenticated routes keep the value AuthMiddleware just wrote.
 */
export function createServiceProxy(target: string, options: { authenticated: boolean }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: options.authenticated,
    on: {
      proxyReq: (proxyReq, req: IncomingMessage) => {
        if (!options.authenticated) {
          proxyReq.removeHeader('x-user-id');
        }
        // Re-send the already-parsed body, otherwise the upstream request hangs.
        fixRequestBody(proxyReq, req as never);
      },
    },
  });
}
