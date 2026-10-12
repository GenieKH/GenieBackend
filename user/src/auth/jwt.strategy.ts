import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

interface AccessTokenPayload {
  sub: string;
  role: string;
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

  validate(payload: AccessTokenPayload) {
    return { userId: payload.sub, role: payload.role };
  }
}
