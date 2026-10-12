/**
 * Allows a fixed number of attempts per key (an email, a phone number) in a
 * time window, so a password or a 6-digit code cannot be guessed by trying
 * them all. Counts are kept in memory: correct for the single auth instance
 * this project runs; move them to Redis before running several.
 */
export class AttemptLimiter {
  /** Above this many tracked keys, expired ones are swept out. */
  private static readonly SWEEP_THRESHOLD = 10_000;

  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records one attempt. Returns false once the key has none left in this window. */
  tryConsume(key: string): boolean {
    const now = this.now();
    const window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      this.sweepIfLarge(now);
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    window.count += 1;
    return window.count <= this.limit;
  }

  /** Forgets a key, e.g. after a successful login. */
  reset(key: string): void {
    this.windows.delete(key);
  }

  private sweepIfLarge(now: number): void {
    if (this.windows.size < AttemptLimiter.SWEEP_THRESHOLD) return;
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
