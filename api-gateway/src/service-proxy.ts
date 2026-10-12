import { fixRequestBody, createProxyMiddleware } from 'http-proxy-middleware';
import type { IncomingMessage } from 'http';

/**
 * Headers the gateway writes for the internal services. A client can send the
 * same names, so each is always overwritten or removed here, never passed on.
 */
const USER_ID_HEADER = 'x-user-id';
const CLIENT_IP_HEADER = 'x-client-ip';

/**
 * Builds a reverse proxy to one of the internal services.
 *
 * `x-user-id` is how services learn who is calling, so it must only ever be
 * set by our own AuthMiddleware after verifying a JWT:
 * - public routes strip it, so a client cannot pretend to be someone else;
 * - authenticated routes keep the value AuthMiddleware just wrote.
 *
 * `x-client-ip` is the caller's address as this gateway sees it. The services
 * only ever see the gateway's own address, and need the real one to show
 * where a device signed in from.
 */
export function createServiceProxy(target: string, options: { authenticated: boolean }) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: options.authenticated,
    on: {
      proxyReq: (proxyReq, req: IncomingMessage) => {
        if (!options.authenticated) {
          proxyReq.removeHeader(USER_ID_HEADER);
        }

        // Express resolves `ip` from the socket and the trusted proxy in front of us.
        const clientIp = (req as IncomingMessage & { ip?: string }).ip;
        if (clientIp) proxyReq.setHeader(CLIENT_IP_HEADER, clientIp);
        else proxyReq.removeHeader(CLIENT_IP_HEADER);

        // Re-send the already-parsed body, otherwise the upstream request hangs.
        fixRequestBody(proxyReq, req as never);
      },
    },
  });
}
