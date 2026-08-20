import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-fallback-key',
    });
  }

  async validate(payload: any) {
    // This payload is the decoded JWT. We return an object that Passport will
    // attach to the Request object as `req.user`.
    return { userId: payload.sub, role: payload.role };
  }
}
