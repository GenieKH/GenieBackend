import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../users/user.repository';
import { ActiveSession, RefreshTokenRepository } from './refresh-token.repository';
import { TokenIssuerService, TokenPair } from './token-issuer.service';

interface RefreshPayload {
  sub?: string;
  jti?: string;
}

/** Refresh-token rotation, logout and session listing. */
@Injectable()
export class SessionService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(RefreshTokenRepository) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(TokenIssuerService) private readonly issuer: TokenIssuerService,
    @Inject(UserRepository) private readonly users: UserRepository,
  ) {}

  /** Exchanges a refresh token for a new pair; the old token can never be used again. */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const { sub, jti } = this.verifyRefreshToken(refreshToken);

    const record = await this.refreshTokens.findById(jti);
    if (!record) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (record.revoked) {
      // A revoked token being presented again means it was stolen.
      await this.refreshTokens.revokeAllForUser(sub);
      throw new UnauthorizedException('Token theft detected. All sessions revoked.');
    }

    if (!(await bcrypt.compare(refreshToken, record.token_hash))) {
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    // Atomic: only one concurrent request can win the revoke.
    const won = await this.refreshTokens.revokeIfActive(jti);
    if (!won) {
      await this.refreshTokens.revokeAllForUser(sub);
      throw new UnauthorizedException('Token theft detected (Concurrent). All sessions revoked.');
    }

    const user = await this.users.findById(sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.issuer.issue(sub, user.role);
  }

  /** Revokes one refresh token (single-device logout). Expired tokens are accepted. */
  async logout(refreshToken: string): Promise<{ message: string }> {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(refreshToken, { ignoreExpiration: true });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!payload.jti) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }

    await this.refreshTokens.revokeById(payload.jti);
    return { message: 'Logged out successfully' };
  }

  listSessions(userId: string): Promise<ActiveSession[]> {
    return this.refreshTokens.listActiveForUser(userId);
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.refreshTokens.revokeAllForUser(userId);
    return { message: 'All sessions revoked successfully' };
  }

  private verifyRefreshToken(token: string): { sub: string; jti: string } {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!payload.sub || !payload.jti) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }
    return { sub: payload.sub, jti: payload.jti };
  }
}
