import {
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { AttemptLimiter, AuthAttemptLimits } from './attempt-limiter';
import { AuthController } from './auth.controller';

// The Firebase SDK is not needed here and cannot be loaded by Jest.
jest.mock('./social/firebase-login.service', () => ({
  FirebaseLoginService: class {},
}));
jest.mock('../firebase/firebase.service', () => ({
  FirebaseService: class {},
}));

const MINUTE = 60 * 1000;

describe('AttemptLimiter', () => {
  const limiterOf = (points: number, duration: number) =>
    new AttemptLimiter(new RateLimiterMemory({ points, duration }));

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows the limit, then refuses until the window ends', async () => {
    jest.useFakeTimers();
    const limiter = limiterOf(3, 60);

    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.tryConsume('a'));
    expect(results).toEqual([true, true, true, false]);

    jest.advanceTimersByTime(61_000);
    expect(await limiter.tryConsume('a')).toBe(true);
  });

  it('counts each key separately and can forget one', async () => {
    const limiter = limiterOf(1, 60);

    expect(await limiter.tryConsume('a')).toBe(true);
    expect(await limiter.tryConsume('b')).toBe(true);
    expect(await limiter.tryConsume('a')).toBe(false);

    await limiter.reset('a');
    expect(await limiter.tryConsume('a')).toBe(true);
  });

  it('does not mistake a broken limiter for "too many attempts"', async () => {
    const broken = new AttemptLimiter({
      consume: () => Promise.reject(new Error('limiter crashed')),
      delete: () => Promise.resolve(true),
    });

    await expect(broken.tryConsume('a')).rejects.toThrow('limiter crashed');
  });
});

describe('AuthController attempt limits', () => {
  const credentials = { login: jest.fn(), register: jest.fn() };
  const passwordReset = {
    requestReset: jest.fn(),
    verifyOtp: jest.fn(),
    resetPassword: jest.fn(),
  };
  const client = { deviceName: null, platform: null, ipAddress: null };
  let controller: AuthController;

  const newController = () =>
    new AuthController(
      credentials as never,
      {} as never,
      {} as never,
      passwordReset as never,
      new AuthAttemptLimits(),
    );

  const tooMany = async (run: () => Promise<unknown>) => {
    const tooManyRequests: number = HttpStatus.TOO_MANY_REQUESTS;
    try {
      await run();
    } catch (error) {
      return (
        error instanceof HttpException && error.getStatus() === tooManyRequests
      );
    }
    return false;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    credentials.login.mockRejectedValue(
      new UnauthorizedException('Invalid credentials'),
    );
    passwordReset.verifyOtp.mockResolvedValue({ verified: false });
    controller = newController();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops password guessing on one account after 10 wrong tries', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(
        controller.login(
          { email: 'Dara@Example.com', password: `guess-${i}` },
          client,
        ),
      ).rejects.toThrow(UnauthorizedException);
    }

    // Same account, typed differently: still blocked, and the password is not even checked.
    await expect(
      controller.login(
        { email: ' dara@example.com ', password: 'guess-11' },
        client,
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(credentials.login).toHaveBeenCalledTimes(10);
  });

  it('does not let one locked account lock another', async () => {
    for (let i = 0; i < 11; i++) {
      await controller
        .login({ email: 'dara@example.com', password: 'x' }, client)
        .catch(() => undefined);
    }

    await expect(
      controller.login({ email: 'sok@example.com', password: 'x' }, client),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('forgets earlier typos after a successful login', async () => {
    for (let i = 0; i < 9; i++) {
      await controller
        .login({ email: 'dara@example.com', password: 'typo' }, client)
        .catch(() => undefined);
    }
    credentials.login.mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });
    await controller.login(
      { email: 'dara@example.com', password: 'right' },
      client,
    );

    credentials.login.mockRejectedValue(
      new UnauthorizedException('Invalid credentials'),
    );
    for (let i = 0; i < 10; i++) {
      await expect(
        controller.login(
          { email: 'dara@example.com', password: 'typo' },
          client,
        ),
      ).rejects.toThrow(UnauthorizedException);
    }
  });

  it('allows 5 guesses at a reset code per address, across verify and reset', async () => {
    for (let i = 0; i < 3; i++)
      await controller.verifyOtp({ email: 'dara@example.com', otp: '000000' });
    for (let i = 0; i < 2; i++) {
      await controller.resetPassword({
        email: 'dara@example.com',
        otp: '000000',
        newPassword: 'new-password',
      });
    }

    expect(
      await tooMany(() =>
        controller.verifyOtp({ email: 'dara@example.com', otp: '000001' }),
      ),
    ).toBe(true);
    expect(
      await tooMany(() =>
        controller.resetPassword({
          email: 'DARA@example.com',
          otp: '1',
          newPassword: 'new-password',
        }),
      ),
    ).toBe(true);
    expect(passwordReset.verifyOtp).toHaveBeenCalledTimes(3);
    expect(passwordReset.resetPassword).toHaveBeenCalledTimes(2);
  });

  it('allows 15 guesses at reset codes per address in a day', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    controller = newController();
    for (let window = 0; window < 3; window++) {
      for (let i = 0; i < 5; i++)
        await controller.verifyOtp({
          email: 'dara@example.com',
          otp: '000000',
        });
      jest.advanceTimersByTime(16 * MINUTE);
    }

    // A fresh 15-minute window, but the day's guesses are used up.
    expect(
      await tooMany(() =>
        controller.verifyOtp({ email: 'dara@example.com', otp: '000000' }),
      ),
    ).toBe(true);
    expect(passwordReset.verifyOtp).toHaveBeenCalledTimes(15);

    jest.advanceTimersByTime(24 * 60 * MINUTE);
    expect(
      await tooMany(() =>
        controller.verifyOtp({ email: 'dara@example.com', otp: '000000' }),
      ),
    ).toBe(false);
  });

  describe('reset emails', () => {
    const forgot = (email: string, ipAddress: string | null = null) =>
      controller.forgotPassword({ email }, { ...client, ipAddress });

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
      controller = newController();
    });

    it('sends one per address a minute', async () => {
      await forgot('dara@example.com');

      expect(await tooMany(() => forgot('DARA@example.com'))).toBe(true);
      jest.advanceTimersByTime(MINUTE + 1000);
      expect(await tooMany(() => forgot('dara@example.com'))).toBe(false);
      expect(passwordReset.requestReset).toHaveBeenCalledTimes(2);
    });

    it('sends at most 3 per address in the window', async () => {
      for (let i = 0; i < 3; i++) {
        await forgot('dara@example.com');
        jest.advanceTimersByTime(MINUTE + 1000);
      }

      expect(await tooMany(() => forgot('dara@example.com'))).toBe(true);
      expect(passwordReset.requestReset).toHaveBeenCalledTimes(3);
    });

    it('sends at most 6 per address in a day', async () => {
      for (let window = 0; window < 2; window++) {
        for (let i = 0; i < 3; i++) {
          await forgot('dara@example.com');
          jest.advanceTimersByTime(MINUTE + 1000);
        }
        jest.advanceTimersByTime(16 * MINUTE);
      }

      // A fresh 15-minute window, but the day's emails are used up.
      expect(await tooMany(() => forgot('dara@example.com'))).toBe(true);
      expect(passwordReset.requestReset).toHaveBeenCalledTimes(6);
    });

    it('takes at most 10 requests an hour from one caller, whatever the addresses', async () => {
      for (let i = 0; i < 10; i++)
        await forgot(`person${i}@example.com`, '203.0.113.7');

      expect(
        await tooMany(() => forgot('someone-else@example.com', '203.0.113.7')),
      ).toBe(true);
      expect(
        await tooMany(() => forgot('someone-else@example.com', '198.51.100.2')),
      ).toBe(false);
      expect(passwordReset.requestReset).toHaveBeenCalledTimes(11);
    });

    it('does not use up the address allowance when the caller is refused', async () => {
      for (let i = 0; i < 10; i++)
        await forgot(`person${i}@example.com`, '203.0.113.7');

      expect(
        await tooMany(() => forgot('dara@example.com', '203.0.113.7')),
      ).toBe(true);
      expect(
        await tooMany(() => forgot('dara@example.com', '198.51.100.2')),
      ).toBe(false);
    });
  });
});
