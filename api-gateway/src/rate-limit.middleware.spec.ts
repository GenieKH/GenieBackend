import { createRateLimitMiddleware } from './rate-limit.middleware';

describe('rate limit middleware', () => {
  let now: number;

  function request(limiter: ReturnType<typeof createRateLimitMiddleware>, ip: string) {
    const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    limiter({ ip } as never, res as never, next);
    return { passed: next.mock.calls.length === 1, res };
  }

  beforeEach(() => {
    now = 0;
  });

  it('lets a client through up to the limit, then answers 429', () => {
    const limiter = createRateLimitMiddleware({ limit: 3, windowMs: 60_000 }, () => now);

    expect([1, 2, 3].map(() => request(limiter, '1.1.1.1').passed)).toEqual([true, true, true]);

    const blocked = request(limiter, '1.1.1.1');
    expect(blocked.passed).toBe(false);
    expect(blocked.res.status).toHaveBeenCalledWith(429);
    expect(blocked.res.setHeader).toHaveBeenCalledWith('Retry-After', 60);
  });

  it('counts each client address on its own', () => {
    const limiter = createRateLimitMiddleware({ limit: 1, windowMs: 60_000 }, () => now);
    request(limiter, '1.1.1.1');

    expect(request(limiter, '1.1.1.1').passed).toBe(false);
    expect(request(limiter, '2.2.2.2').passed).toBe(true);
  });

  it('starts over when the window ends', () => {
    const limiter = createRateLimitMiddleware({ limit: 1, windowMs: 60_000 }, () => now);
    request(limiter, '1.1.1.1');
    expect(request(limiter, '1.1.1.1').passed).toBe(false);

    now = 60_000;
    expect(request(limiter, '1.1.1.1').passed).toBe(true);
  });
});
