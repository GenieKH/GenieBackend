import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import {
  ACCESS_TOKEN_TTL,
  ACCESS_TOKEN_TYPE,
  BCRYPT_ROUNDS,
  REFRESH_TOKEN_TTL_DAYS,
  REFRESH_TOKEN_TYPE,
} from '../auth.constants';
import { RefreshTokenRepository } from './refresh-token.repository';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Signs a new access/refresh token pair and records the refresh token. */
@Injectable()
export class TokenIssuerService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(RefreshTokenRepository) private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async issue(userId: string, role: string): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: userId, role, typ: ACCESS_TOKEN_TYPE },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    // The jti ties the signed token to its database row so it can be revoked.
    const jti = randomUUID();
    const refreshToken = this.jwt.sign(
      { sub: userId, jti, typ: REFRESH_TOKEN_TYPE },
      { expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` },
    );

    await this.refreshTokens.insert({
      id: jti,
      userId,
      tokenHash: await bcrypt.hash(refreshToken, BCRYPT_ROUNDS),
      expiresAt: this.refreshExpiry(),
    });

    return { accessToken, refreshToken };
  }

  private refreshExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
    return expiresAt;
  }
}
