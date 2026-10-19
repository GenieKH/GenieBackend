import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

interface AccessTokenPayload {
  sub: string;
  role: string;
  typ?: string;
  /** The session (signed-in device). Missing from tokens issued before sessions existed. */
  sid?: string;
}

/** What `req.user` holds once the access token is verified. */
export interface AuthenticatedUser {
  userId: string;
  role: string;
  sessionId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '',
      algorithms: ['RS256'],
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    // Refresh tokens are signed with the same key and must not open the API.
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Not an access token');
    }
    return { userId: payload.sub, role: payload.role, sessionId: typeof payload.sid === 'string' ? payload.sid : null };
  }
}
