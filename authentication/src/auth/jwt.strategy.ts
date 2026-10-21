import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ACCESS_TOKEN_TYPE } from './auth.constants';
import { AuthenticatedUser } from './decorators/current-user.decorator';
import { RevokedSessionStore } from './sessions/revoked-session.store';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(RevokedSessionStore) private readonly revoked: RevokedSessionStore,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '',
      algorithms: ['RS256'],
    });
  }

  /** `payload` is the verified JWT; the result becomes `req.user`. */
  async validate(payload: {
    sub: string;
    role: string;
    typ?: string;
    sid?: string;
  }): Promise<AuthenticatedUser> {
    if (payload.typ !== ACCESS_TOKEN_TYPE) {
      throw new UnauthorizedException('Not an access token');
    }
    // The gateway does not check tokens on `/auth` routes, so a signed-out device is refused here.
    if (payload.sid && (await this.revoked.has(payload.sid))) {
      throw new UnauthorizedException('This device was signed out');
    }
    return {
      userId: payload.sub,
      role: payload.role,
      sessionId: payload.sid ?? null,
    };
  }
}
