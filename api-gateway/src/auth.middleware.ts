import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Verifies the access token and writes the caller's id to `x-user-id`
 * for the downstream services. Anything the client sent in that header is
 * overwritten.
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
      const userId = typeof payload === 'string' ? undefined : payload.sub;
      if (!userId) throw new Error('Token has no subject');

      req.headers['x-user-id'] = userId;
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
