import { poolOptions } from './pool-options';

describe('poolOptions', () => {
  it('keeps the driver defaults when nothing is set', () => {
    expect(poolOptions({})).toEqual({
      max: 10,
      min: 0,
      idleTimeoutMillis: 10_000,
      keepAlive: true,
    });
  });

  it('keeps connections open when asked to', () => {
    expect(
      poolOptions({
        DATABASE_POOL_MAX: '3',
        DATABASE_POOL_MIN: '1',
        DATABASE_POOL_IDLE_SECONDS: '300',
      }),
    ).toEqual({ max: 3, min: 1, idleTimeoutMillis: 300_000, keepAlive: true });
  });

  it('never keeps more connections open than it may have', () => {
    expect(
      poolOptions({ DATABASE_POOL_MAX: '3', DATABASE_POOL_MIN: '8' }).min,
    ).toBe(3);
  });

  it('ignores values that are not whole numbers', () => {
    expect(
      poolOptions({
        DATABASE_POOL_MAX: 'lots',
        DATABASE_POOL_MIN: '-1',
        DATABASE_POOL_IDLE_SECONDS: '1.5',
      }),
    ).toEqual({ max: 10, min: 0, idleTimeoutMillis: 10_000, keepAlive: true });
  });

  it('does not accept a pool of no connections', () => {
    expect(poolOptions({ DATABASE_POOL_MAX: '0' }).max).toBe(10);
  });
});
