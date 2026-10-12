import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SessionService } from './session.service';

describe('SessionService', () => {
  const REFRESH_TOKEN = 'signed.refresh.token';
  const jwt = { verify: jest.fn() };
  const refreshTokens = {
    findById: jest.fn(),
    revokeIfActive: jest.fn(),
    revokeById: jest.fn(),
    revokeAllForUser: jest.fn(),
    listActiveForUser: jest.fn(),
  };
  const issuer = { issue: jest.fn() };
  const users = { findById: jest.fn() };
  let service: SessionService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SessionService(jwt as never, refreshTokens as never, issuer as never, users as never);
    jwt.verify.mockReturnValue({ sub: 'u1', jti: 't1' });
  });

  describe('refresh', () => {
    it('rotates: revokes the used token and issues a new pair', async () => {
      refreshTokens.findById.mockResolvedValue({
        id: 't1',
        revoked: false,
        token_hash: bcrypt.hashSync(REFRESH_TOKEN, 4),
      });
      refreshTokens.revokeIfActive.mockResolvedValue(true);
      users.findById.mockResolvedValue({ id: 'u1', role: 'agent' });
      issuer.issue.mockResolvedValue({ accessToken: 'new-a', refreshToken: 'new-r' });

      const result = await service.refresh(REFRESH_TOKEN);

      expect(refreshTokens.revokeIfActive).toHaveBeenCalledWith('t1');
      expect(issuer.issue).toHaveBeenCalledWith('u1', 'agent');
      expect(result).toEqual({ accessToken: 'new-a', refreshToken: 'new-r' });
    });

    it('treats a replayed (already revoked) token as theft and revokes every session', async () => {
      refreshTokens.findById.mockResolvedValue({ id: 't1', revoked: true, token_hash: 'x' });

      await expect(service.refresh(REFRESH_TOKEN)).rejects.toThrow(UnauthorizedException);
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
      expect(issuer.issue).not.toHaveBeenCalled();
    });

    it('revokes everything when two requests race to use the same token', async () => {
      refreshTokens.findById.mockResolvedValue({
        id: 't1',
        revoked: false,
        token_hash: bcrypt.hashSync(REFRESH_TOKEN, 4),
      });
      refreshTokens.revokeIfActive.mockResolvedValue(false);

      await expect(service.refresh(REFRESH_TOKEN)).rejects.toThrow(UnauthorizedException);
      expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
    });

    it('rejects a token that fails signature verification', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('garbage')).rejects.toThrow(UnauthorizedException);
      expect(refreshTokens.findById).not.toHaveBeenCalled();
    });

    it('rejects a token whose database row is gone', async () => {
      refreshTokens.findById.mockResolvedValue(null);

      await expect(service.refresh(REFRESH_TOKEN)).rejects.toThrow('Refresh token not found');
    });
  });

  describe('logout', () => {
    it('revokes the token even when it has already expired', async () => {
      await service.logout(REFRESH_TOKEN);

      expect(jwt.verify).toHaveBeenCalledWith(REFRESH_TOKEN, { ignoreExpiration: true });
      expect(refreshTokens.revokeById).toHaveBeenCalledWith('t1');
    });
  });

  it('logoutAll revokes every session of the user', async () => {
    await service.logoutAll('u1');

    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});
