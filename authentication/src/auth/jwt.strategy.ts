import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ACCESS_TOKEN_TYPE } from './auth.constants';

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

  /** `payload` is the verified JWT; the result becomes `req.user`. */
  validate(payload: { sub: string; role: string; typ?: string }) {
    if (payload.typ !== ACCESS_TOKEN_TYPE) {
      throw new UnauthorizedException('Not an access token');
    }
    return { userId: payload.sub, role: payload.role };
  }
}
