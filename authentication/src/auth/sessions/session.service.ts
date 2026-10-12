import { ForbiddenException, HttpStatus, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRepository } from '../users/user.repository';
import { ClientContext } from './client-context';
import { RefreshTokenRecord, RefreshTokenRepository } from './refresh-token.repository';
import { SessionRevocationService } from './session-revocation.service';
import { TokenIssuerService, TokenPair } from './token-issuer.service';

interface RefreshPayload {
  sub?: string;
  jti?: string;
}

/** One signed-in device, as the app lists it. */
export interface DeviceSession {
  id: string;
  deviceName: string | null;
  platform: string | null;
  ipAddress: string | null;
  location: string | null;
  signedInAt: string;
  lastUsedAt: string;
  /** True for the session that asked for the list. */
  current: boolean;
}

/** The devices signed in to an account, and what the asking device may do about them. */
export interface DeviceList {
  sessions: DeviceSession[];
  canSignOutOthers: boolean;
  /** When that becomes true. Null if this device's own session is not known. */
  canSignOutOthersFrom: string | null;
}

/** The session a request comes from. `sessionId` is null for a token from before sessions existed. */
export interface SessionCaller {
  userId: string;
  sessionId: string | null;
}

/**
 * How long a device must have been signed in before it may sign other devices
 * out. Someone who just got into an account (a stolen password) could
 * otherwise lock its owner out at once; this way the owner's own, older
 * devices can remove the newcomer first.
 */
export const SIGN_OUT_OTHERS_AFTER_MS = 24 * 60 * 60 * 1000;

function startedAt(token: RefreshTokenRecord): string {
  return token.session_started_at ?? token.created_at;
}

/** Refresh-token rotation, logout and the list of signed-in devices. */
@Injectable()
export class SessionService {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(RefreshTokenRepository) private readonly refreshTokens: RefreshTokenRepository,
    @Inject(TokenIssuerService) private readonly issuer: TokenIssuerService,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(SessionRevocationService) private readonly revocations: SessionRevocationService,
  ) {}

  /** Exchanges a refresh token for a new pair; the old token can never be used again. */
  async refresh(refreshToken: string, client: ClientContext): Promise<TokenPair> {
    const { sub, jti } = this.verifyRefreshToken(refreshToken);

    const record = await this.refreshTokens.findById(jti);
    if (!record) {
      throw new UnauthorizedException('Refresh token not found');
    }

    if (record.revoked) {
      await this.rejectRevokedToken(record, sub);
    }

    if (!(await bcrypt.compare(refreshToken, record.token_hash))) {
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    // Atomic: only one concurrent request can win the revoke.
    const won = await this.refreshTokens.revokeIfActive(jti);
    if (!won) {
      await this.revocations.endAllSessions(sub);
      throw new UnauthorizedException('Token theft detected (Concurrent). All sessions revoked.');
    }

    const user = await this.users.findById(sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.issuer.issue(sub, user.role, client, record);
  }

  /** Signs out the device that holds this refresh token. Expired tokens are accepted. */
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

    await this.revocations.endSessionOfToken(payload.jti);
    return { message: 'Logged out successfully' };
  }

  async listSessions(caller: SessionCaller): Promise<DeviceList> {
    const tokens = await this.refreshTokens.listSessionTokens(caller.userId);
    const allowedFrom = this.signOutOthersAllowedFrom(tokens, caller);

    return {
      sessions: tokens.map((token) => ({
        id: token.session_id!,
        deviceName: token.device_name,
        platform: token.platform,
        ipAddress: token.ip_address,
        location: token.location,
        signedInAt: startedAt(token),
        // Each use replaces the token, so the live token's age is the time since the last use.
        lastUsedAt: token.created_at,
        current: token.session_id === caller.sessionId,
      })),
      canSignOutOthers: allowedFrom !== null && allowedFrom.getTime() <= Date.now(),
      canSignOutOthersFrom: allowedFrom?.toISOString() ?? null,
    };
  }

  /** Signs one device out, at once. Another device than the caller's needs `requireMaySignOutOthers`. */
  async revokeSession(caller: SessionCaller, sessionId: string): Promise<{ message: string }> {
    if (sessionId !== caller.sessionId) {
      await this.requireMaySignOutOthers(caller);
    }
    if (!(await this.revocations.endSession(caller.userId, sessionId))) {
      throw new NotFoundException('Session not found');
    }
    return { message: 'Device signed out' };
  }

  /** Signs every device out, the caller's included. */
  async logoutAll(caller: SessionCaller): Promise<{ message: string }> {
    await this.requireMaySignOutOthers(caller);
    await this.revocations.endAllSessions(caller.userId);
    return { message: 'All sessions revoked successfully' };
  }

  /** `403` while the caller's device is too new to sign others out (see `SIGN_OUT_OTHERS_AFTER_MS`). */
  private async requireMaySignOutOthers(caller: SessionCaller): Promise<void> {
    const tokens = await this.refreshTokens.listSessionTokens(caller.userId);
    const allowedFrom = this.signOutOthersAllowedFrom(tokens, caller);
    if (allowedFrom && allowedFrom.getTime() <= Date.now()) return;

    throw new ForbiddenException({
      statusCode: HttpStatus.FORBIDDEN,
      message: 'This device signed in less than a day ago, so it cannot sign other devices out yet.',
      canSignOutOthersFrom: allowedFrom?.toISOString() ?? null,
    });
  }

  private signOutOthersAllowedFrom(tokens: RefreshTokenRecord[], caller: SessionCaller): Date | null {
    const own = tokens.find((token) => token.session_id === caller.sessionId);
    return own ? new Date(new Date(startedAt(own)).getTime() + SIGN_OUT_OTHERS_AFTER_MS) : null;
  }

  /**
   * A revoked token is being presented. If its session has moved on to a newer
   * token, two parties hold tokens of one session: it was stolen, so every
   * session ends. If the session has no usable token, the device was simply
   * signed out (here or from another device) and only needs to log in again.
   */
  private async rejectRevokedToken(record: RefreshTokenRecord, userId: string): Promise<never> {
    const signedOut = record.session_id !== null && !(await this.refreshTokens.hasActiveToken(record.session_id));
    if (signedOut) {
      throw new UnauthorizedException('This device was signed out. Please log in again.');
    }

    await this.revocations.endAllSessions(userId);
    throw new UnauthorizedException('Token theft detected. All sessions revoked.');
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
