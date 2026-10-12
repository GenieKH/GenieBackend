import { HttpException, Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Namespace, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { PresenceTargetDto, SendMessageDto } from './dto/chat.dto';
import { PresenceService } from './presence.service';
import { extractSocketToken, verifyAccessToken } from './ws-auth';
import { WsJwtGuard } from './ws-jwt.guard';

/** Every device a user is signed in on joins this room. */
function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** Sockets that want to know when this user comes online or goes offline. */
function presenceRoom(userId: string): string {
  return `presence:${userId}`;
}

/** Reads a socket payload into a DTO, or returns null if it is not valid. */
function parsePayload<T extends object>(dto: new () => T, payload: unknown): T | null {
  const isObject = typeof payload === 'object' && payload !== null && !Array.isArray(payload);
  const parsed = plainToInstance(dto, isObject ? payload : {});
  return validateSync(parsed, { whitelist: true }).length > 0 ? null : parsed;
}

/**
 * Real-time delivery of end-to-end encrypted messages, and who is online.
 * The server only stores and forwards ciphertext; it cannot read messages.
 */
// Mobile clients do not use CORS, so no browser origin is allowed.
@WebSocketGateway({ cors: { origin: false }, namespace: '/chat' })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Namespace;

  private readonly logger = new Logger(ChatGateway.name);

  /** Stops one account from flooding others: 30 messages per 10 seconds. */
  private readonly sendRateLimiter = new RateLimiterMemory({ points: 30, duration: 10 });

  constructor(
    private readonly chatService: ChatService,
    private readonly presenceService: PresenceService,
  ) {}

  /** Rejects the handshake itself, so an unauthenticated socket never connects. */
  afterInit(server: Namespace) {
    server.use((client, next) => {
      try {
        const token = extractSocketToken(client);
        if (!token) throw new Error('No token provided');

        client.data.userId = verifyAccessToken(token);
        next();
      } catch (error) {
        this.logger.warn(`Connection rejected: ${(error as Error).message}`);
        next(new Error('unauthorized'));
      }
    });
  }

  async handleConnection(client: Socket) {
    const userId: string = client.data.userId;
    const cameOnline = !this.isOnline(userId);

    await client.join(userRoom(userId));
    if (cameOnline) {
      this.server.to(presenceRoom(userId)).emit('presence', { userId, online: true, lastSeenAt: null });
    }
  }

  /** The user is offline once their last device has disconnected. */
  async handleDisconnect(client: Socket) {
    const userId: string | undefined = client.data.userId;
    if (!userId || this.isOnline(userId)) return;

    try {
      const lastSeenAt = await this.presenceService.markLastSeen(userId);
      this.server.to(presenceRoom(userId)).emit('presence', { userId, online: false, lastSeenAt });
    } catch (error) {
      this.logger.error(`Failed to record last seen: ${(error as Error).message}`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const senderId: string = client.data.userId;

    const dto = parsePayload(SendMessageDto, payload);
    if (!dto) {
      return { status: 'error', message: 'Invalid message' };
    }

    try {
      await this.sendRateLimiter.consume(senderId);
    } catch {
      return { status: 'error', message: 'You are sending messages too quickly. Wait a moment.' };
    }

    try {
      const message = await this.chatService.sendMessage(senderId, dto);

      // The recipient's devices, plus the sender's other devices.
      client.to(userRoom(message.recipientId)).to(userRoom(senderId)).emit('newMessage', message);

      return { status: 'ok', messageId: message.id, message };
    } catch (error) {
      if (error instanceof HttpException) {
        return { status: 'error', message: error.message };
      }
      this.logger.error(`Failed to send message: ${(error as Error).message}`);
      return { status: 'error', message: 'Failed to process message' };
    }
  }

  /** Replies with the user's current presence and keeps this socket updated. */
  @UseGuards(WsJwtGuard)
  @SubscribeMessage('watchPresence')
  async handleWatchPresence(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const dto = parsePayload(PresenceTargetDto, payload);
    if (!dto) {
      return { status: 'error', message: 'Invalid user' };
    }

    try {
      await client.join(presenceRoom(dto.userId));
      const online = this.isOnline(dto.userId);
      const lastSeenAt = online ? null : await this.presenceService.getLastSeen(dto.userId);
      return { status: 'ok', presence: { userId: dto.userId, online, lastSeenAt } };
    } catch (error) {
      this.logger.error(`Failed to read presence: ${(error as Error).message}`);
      return { status: 'error', message: 'Failed to read presence' };
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('unwatchPresence')
  async handleUnwatchPresence(@ConnectedSocket() client: Socket, @MessageBody() payload: unknown) {
    const dto = parsePayload(PresenceTargetDto, payload);
    if (dto) {
      await client.leave(presenceRoom(dto.userId));
    }
    return { status: 'ok' };
  }

  private isOnline(userId: string): boolean {
    return (this.server.adapter.rooms.get(userRoom(userId))?.size ?? 0) > 0;
  }
}
