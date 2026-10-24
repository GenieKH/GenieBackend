import { ForbiddenException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const userTable = { findFirst: jest.fn() };
  const guard = new AdminGuard({ user: userTable } as never);
  const request = (
    user?: { userId: string },
    headers: Record<string, string> = {},
  ) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user, headers }) }),
    }) as never;

  beforeEach(() => userTable.findFirst.mockReset());

  it('lets an admin in', async () => {
    userTable.findFirst.mockResolvedValue({ role: 'admin' });

    await expect(guard.canActivate(request({ userId: 'a' }))).resolves.toBe(
      true,
    );
  });

  it('reads the caller the gateway wrote when no token was checked here', async () => {
    userTable.findFirst.mockResolvedValue({ role: 'admin' });

    await expect(
      guard.canActivate(request(undefined, { 'x-user-id': 'a' })),
    ).resolves.toBe(true);
    expect(userTable.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a', deactivatedAt: null } }),
    );
  });

  it('keeps everyone else out', async () => {
    userTable.findFirst.mockResolvedValue({ role: 'user' });

    await expect(guard.canActivate(request({ userId: 'u' }))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('keeps out a deactivated or unknown account, and an anonymous caller', async () => {
    userTable.findFirst.mockResolvedValue(null);

    await expect(
      guard.canActivate(request({ userId: 'gone' })),
    ).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(request())).rejects.toThrow(
      ForbiddenException,
    );
  });
});
