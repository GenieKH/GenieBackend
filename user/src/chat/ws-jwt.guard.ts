import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { extractSocketToken, verifyAccessToken } from './ws-auth';

/** Re-checks the socket's token on every message, so expired sessions are cut off. */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client = context.switchToWs().getClient<Socket>();
    const token = extractSocketToken(client);
    if (!token) {
      this.logger.warn('No token provided in WebSocket message');
      client.disconnect();
      return false;
    }

    try {
      client.data.userId = verifyAccessToken(token);
      return true;
    } catch (error) {
      this.logger.warn(`WebSocket authentication failed: ${(error as Error).message}`);
      client.disconnect();
      return false;
    }
  }
}
