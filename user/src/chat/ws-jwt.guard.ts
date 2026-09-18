import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client: Socket = context.switchToWs().getClient<Socket>();
    const token = this.extractTokenFromHeader(client) || this.extractTokenFromQuery(client);

    if (!token) {
      this.logger.warn('No token provided in WebSocket connection');
      client.disconnect();
      return false;
    }

    try {
      const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';
      const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as any;
      
      // Attach the decoded user id to the socket data
      client.data.userId = payload.sub;
      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);
      client.disconnect();
      return false;
    }
  }

  private extractTokenFromHeader(client: Socket): string | undefined {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }
    return undefined;
  }

  private extractTokenFromQuery(client: Socket): string | undefined {
    const token = client.handshake.query.token;
    return typeof token === 'string' ? token : undefined;
  }
}
