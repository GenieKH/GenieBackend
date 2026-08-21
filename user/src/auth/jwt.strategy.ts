import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { requestContext } from './request-context';

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

  async validate(payload: any) {
    const store = requestContext.getStore();
    if (store) {
      store.set('userId', payload.sub);
    }
    return { userId: payload.sub, role: payload.role };
  }
}


