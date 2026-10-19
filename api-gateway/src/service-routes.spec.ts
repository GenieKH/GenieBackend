import { ServerResponse } from 'http';
import { respondUnavailable } from './upstream-unavailable';
import { routesFor, SERVICE_ROUTES, serviceUrlsFromEnv } from './service-routes';

/** The service a path is forwarded to, and whether the gateway demands a JWT for it. */
function resolve(path: string) {
  const matches = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  const route = SERVICE_ROUTES.find(
    (candidate) =>
      candidate.prefixes.some(matches) &&
      !candidate.exclude?.some((excluded) => excluded.path === path),
  );
  const webhook = SERVICE_ROUTES.find((candidate) => candidate.alsoPublic?.some((r) => r.path === path));
  const chosen = webhook ?? route;
  return chosen && { service: chosen.service, authenticated: chosen.authenticated };
}

describe('where the gateway sends each path', () => {
  it.each([
    ['/auth/login', 'auth', false],
    ['/auth/sessions', 'auth', false],
    ['/public/properties/map', 'property', false],
    ['/public/search', 'property', false],
    ['/properties', 'property', true],
    ['/properties/123/images', 'property', true],
    ['/search/history', 'property', true],
    ['/payments/checkout', 'payment', true],
    ['/payments/webhook', 'payment', false],
    ['/users/me', 'user', true],
    ['/chat/conversations', 'chat', true],
    ['/notifications/devices', 'notification', true],
    ['/notifications/promotions', 'notification', true],
  ])('%s goes to %s (JWT required: %s)', (path, service, authenticated) => {
    expect(resolve(path)).toEqual({ service, authenticated });
  });

  it('never forwards /internal, which only the services may call', () => {
    expect(resolve('/internal/accounts/1/files')).toBeUndefined();
  });

  it('lets only the chat service take WebSocket upgrades', () => {
    expect(SERVICE_ROUTES.filter((route) => route.websocket).map((route) => route.service)).toEqual(['chat']);
  });

  it('forwards each prefix both as itself and as a parent of deeper paths', () => {
    expect(routesFor(['/chat']).map((route) => route.path)).toEqual(['/chat', '/chat/{*path}']);
  });

  it('reads the service addresses from the environment, with local defaults', () => {
    expect(serviceUrlsFromEnv({ CHAT_SERVICE_URL: 'http://chat.internal:4004' })).toMatchObject({
      chat: 'http://chat.internal:4004',
      property: 'http://localhost:4003',
      payment: 'http://localhost:4005',
      notification: 'http://localhost:4006',
    });
  });
});

describe('when a service cannot be reached', () => {
  function response(headersSent = false) {
    return {
      headersSent,
      writeHead: jest.fn(),
      end: jest.fn(),
    } as unknown as ServerResponse & { writeHead: jest.Mock; end: jest.Mock };
  }

  it('answers 503 and names the service, so the app can tell which feature is down', () => {
    const res = response();

    respondUnavailable('chat', Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }), res);

    expect(res.writeHead).toHaveBeenCalledWith(503, expect.objectContaining({ 'retry-after': '5' }));
    expect(JSON.parse(res.end.mock.calls[0][0])).toMatchObject({ statusCode: 503, service: 'chat' });
  });

  it('answers 504 for a service that took too long', () => {
    const res = response();

    respondUnavailable('property', Object.assign(new Error('timeout'), { code: 'ECONNRESET' }), res);

    expect(res.writeHead).toHaveBeenCalledWith(504, expect.anything());
  });

  it('only ends a response that has already started', () => {
    const res = response(true);

    respondUnavailable('user', new Error('gone'), res);

    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

  it('closes the socket of a WebSocket upgrade instead of writing a response', () => {
    const socket = { destroy: jest.fn() };

    respondUnavailable('chat', new Error('gone'), socket);

    expect(socket.destroy).toHaveBeenCalled();
  });
});
