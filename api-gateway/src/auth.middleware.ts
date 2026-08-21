import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  // In a real app, this secret would come from ConfigService
  private readonly jwtPublicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n');

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    try {
      if (!this.jwtPublicKey) throw new Error('JWT_PUBLIC_KEY is not defined');
      const decoded: any = jwt.verify(token, this.jwtPublicKey, { algorithms: ['RS256'] });
      // Inject the user ID into the headers for downstream services
      req.headers['x-user-id'] = decoded.sub;
      next();
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

