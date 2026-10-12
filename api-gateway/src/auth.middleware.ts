import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Verifies the access token and writes the caller's id to `x-user-id`
 * for the downstream services. Anything the client sent in that header is
 * overwritten. A refresh token is refused: it is signed with the same key but
 * lives 30 days and is never checked for revocation here.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');

  use(req: Request, _res: Response, next: NextFunction) {
    if (req.method === 'OPTIONS') {
      return next();
    }

    const token = this.readBearerToken(req);
    if (!token || !this.publicKey) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    try {
      const payload = jwt.verify(token, this.publicKey, { algorithms: ['RS256'] });
      if (typeof payload === 'string' || !payload.sub) throw new Error('Token has no subject');
      if (payload.typ !== 'access') throw new Error('Not an access token');

      req.headers['x-user-id'] = payload.sub;
      next();
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private readBearerToken(req: Request): string | null {
    const header = req.headers['authorization'];
    return header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  }
}
