import { NextFunction, Request, Response } from 'express';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Limits how many requests one client address may make per minute.
 *
 * It has to be a middleware placed before the service proxies: the proxies
 * answer the request themselves, so Nest guards (including ThrottlerGuard)
 * never run for proxied routes. Counts are kept in memory, which is correct
 * for the single gateway instance this project runs.
 */
export function createRateLimitMiddleware(
  options: { limit: number; windowMs: number },
  now: () => number = Date.now,
) {
  const windows = new Map<string, Window>();
  const SWEEP_THRESHOLD = 10_000;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const time = now();
    let window = windows.get(key);

    if (!window || window.resetAt <= time) {
      if (windows.size >= SWEEP_THRESHOLD) {
        for (const [address, old] of windows) {
          if (old.resetAt <= time) windows.delete(address);
        }
      }
      window = { count: 0, resetAt: time + options.windowMs };
      windows.set(key, window);
    }

    window.count += 1;
    if (window.count > options.limit) {
      res.setHeader('Retry-After', Math.ceil((window.resetAt - time) / 1000));
      res.status(429).json({ statusCode: 429, message: 'Too many requests. Please slow down.' });
      return;
    }
    next();
  };
}
