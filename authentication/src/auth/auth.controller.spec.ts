import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AttemptLimiter } from './attempt-limiter';
import { AuthController } from './auth.controller';

// The Firebase SDK is not needed here and cannot be loaded by Jest.
jest.mock('./social/firebase-login.service', () => ({ FirebaseLoginService: class {} }));

describe('AttemptLimiter', () => {
  it('allows the limit, then refuses until the window ends', () => {
    let now = 0;
    const limiter = new AttemptLimiter(3, 1000, () => now);

    expect([1, 2, 3, 4].map(() => limiter.tryConsume('a'))).toEqual([true, true, true, false]);

    now = 1000;
    expect(limiter.tryConsume('a')).toBe(true);
  });

  it('counts each key separately and can forget one', () => {
    const limiter = new AttemptLimiter(1, 1000);

    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('b')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);

    limiter.reset('a');
    expect(limiter.tryConsume('a')).toBe(true);
  });
});

describe('AuthController attempt limits', () => {
  const credentials = { login: jest.fn(), register: jest.fn() };
  const passwordReset = { requestReset: jest.fn(), verifyOtp: jest.fn(), resetPassword: jest.fn() };
  let controller: AuthController;

  const tooMany = (run: () => unknown) => {
    try {
      run();
    } catch (error) {
      return error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS;
    }
    return false;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    credentials.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));
    passwordReset.verifyOtp.mockResolvedValue({ verified: false });
    controller = new AuthController(credentials as never, {} as never, {} as never, passwordReset as never);
  });

  it('stops password guessing on one account after 10 wrong tries', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(controller.login({ email: 'Dara@Example.com', password: `guess-${i}` })).rejects.toThrow(
        UnauthorizedException,
      );
    }

    // Same account, typed differently: still blocked, and the password is not even checked.
    await expect(controller.login({ email: ' dara@example.com ', password: 'guess-11' })).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(credentials.login).toHaveBeenCalledTimes(10);
  });

  it('does not let one locked account lock another', async () => {
    for (let i = 0; i < 11; i++) {
      await controller.login({ email: 'dara@example.com', password: 'x' }).catch(() => undefined);
    }

    await expect(controller.login({ email: 'sok@example.com', password: 'x' })).rejects.toThrow(UnauthorizedException);
  });

  it('forgets earlier typos after a successful login', async () => {
    for (let i = 0; i < 9; i++) {
      await controller.login({ email: 'dara@example.com', password: 'typo' }).catch(() => undefined);
    }
    credentials.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    await controller.login({ email: 'dara@example.com', password: 'right' });

    credentials.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));
    for (let i = 0; i < 10; i++) {
      await expect(controller.login({ email: 'dara@example.com', password: 'typo' })).rejects.toThrow(
        UnauthorizedException,
      );
    }
  });

  it('allows 5 guesses at a reset code per address, across verify and reset', () => {
    for (let i = 0; i < 3; i++) controller.verifyOtp({ email: 'dara@example.com', otp: '000000' });
    for (let i = 0; i < 2; i++) {
      controller.resetPassword({ email: 'dara@example.com', otp: '000000', newPassword: 'new-password' });
    }

    expect(tooMany(() => controller.verifyOtp({ email: 'dara@example.com', otp: '000001' }))).toBe(true);
    expect(
      tooMany(() => controller.resetPassword({ email: 'DARA@example.com', otp: '1', newPassword: 'new-password' })),
    ).toBe(true);
    expect(passwordReset.verifyOtp).toHaveBeenCalledTimes(3);
    expect(passwordReset.resetPassword).toHaveBeenCalledTimes(2);
  });

  it('allows 15 guesses at reset codes per address in a day', () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') });
    try {
      controller = new AuthController(credentials as never, {} as never, {} as never, passwordReset as never);
      for (let window = 0; window < 3; window++) {
        for (let i = 0; i < 5; i++) controller.verifyOtp({ email: 'dara@example.com', otp: '000000' });
        jest.advanceTimersByTime(16 * 60 * 1000);
      }

      // A fresh 15-minute window, but the day's guesses are used up.
      expect(tooMany(() => controller.verifyOtp({ email: 'dara@example.com', otp: '000000' }))).toBe(true);
      expect(passwordReset.verifyOtp).toHaveBeenCalledTimes(15);

      jest.advanceTimersByTime(24 * 60 * 60 * 1000);
      expect(tooMany(() => controller.verifyOtp({ email: 'dara@example.com', otp: '000000' }))).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends at most 3 reset emails per address in the window', () => {
    for (let i = 0; i < 3; i++) controller.forgotPassword({ email: 'dara@example.com' });

    expect(tooMany(() => controller.forgotPassword({ email: 'dara@example.com' }))).toBe(true);
    expect(passwordReset.requestReset).toHaveBeenCalledTimes(3);
  });
});
