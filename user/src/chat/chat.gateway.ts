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
import { Namespace, Socket } from 'socket.io';
import { RevokedSessions } from '../auth/revoked-sessions.service';
import { RateLimit, RateLimits } from '../redis/rate-limits.service';
import { ChatService } from './chat.service';
import { PresenceTargetDto, SendMessageDto } from './dto/chat.dto';
import { PresenceService } from './presence.service';
import { authenticateSocket } from './ws-auth';
import { WsJwtGuard } from './ws-jwt.guard';

/** Every device a user is signed in on joins this room. */
function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** The connections of one signed-in device, so they can be closed when it is signed out. */
function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

/** Sockets that want to know when this user comes online or goes offline. */
function presenceRoom(userId: string): string {
  return `presence:${userId}`;
}

/** Asking the other instances must never hold up a connection for long. */
const PRESENCE_TIMEOUT_MS = 1000;

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
  private readonly sendRateLimiter: RateLimit;

  constructor(
    private readonly chatService: ChatService,
    private readonly presenceService: PresenceService,
    private readonly revokedSessions: RevokedSessions,
    rateLimits: RateLimits,
  ) {
    this.sendRateLimiter = rateLimits.create('chat-send', 30, 10);
  }

  /** Rejects the handshake itself, so an unauthenticated socket never connects. */
  afterInit(server: Namespace) {
    server.use(async (client, next) => {
      try {
        await authenticateSocket(client, this.revokedSessions);
        next();
      } catch (error) {
        this.logger.warn(`Connection rejected: ${(error as Error).message}`);
        next(new Error('unauthorized'));
      }
    });

    // A device that is signed out stops receiving messages at once, not when
    // its token expires. Every instance hears this and closes its own sockets.
    this.revokedSessions.onRevoked((sessionId) => {
      server.local.in(sessionRoom(sessionId)).disconnectSockets(true);
    });
  }

  async handleConnection(client: Socket) {
    const userId: string = client.data.userId;
    const sessionId: string | null = client.data.sessionId ?? null;
    // Joined first: receiving messages must not wait for the presence check below.
    await client.join(sessionId ? [userRoom(userId), sessionRoom(sessionId)] : userRoom(userId));
    const cameOnline = (await this.connectedDevices(userId)) <= 1;

    this.logger.log(`Connected: user ${userId} (socket ${client.id})`);
    if (cameOnline) {
      this.server.to(presenceRoom(userId)).emit('presence', { userId, online: true, lastSeenAt: null });
    }
  }

  /** The user is offline once their last device has disconnected. */
  async handleDisconnect(client: Socket) {
    const userId: string | undefined = client.data.userId;
    if (!userId) return;
    this.logger.log(`Disconnected: user ${userId} (socket ${client.id})`);
    if ((await this.connectedDevices(userId)) > 0) return;

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

    await client.join(presenceRoom(dto.userId));
    const online = (await this.connectedDevices(dto.userId)) > 0;
    return { status: 'ok', presence: { userId: dto.userId, online, lastSeenAt: await this.lastSeenOf(dto.userId, online) } };
  }

  /** Online status is still worth showing when "last seen" cannot be read. */
  private async lastSeenOf(userId: string, online: boolean): Promise<Date | null> {
    if (online) return null;
    try {
      return await this.presenceService.getLastSeen(userId);
    } catch (error) {
      this.logger.error(`Failed to read last seen: ${(error as Error).message}`);
      return null;
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

  /** How many devices the user has connected, counted across every instance of this service. */
  private async connectedDevices(userId: string): Promise<number> {
    let timer: NodeJS.Timeout | undefined;
    const tooSlow = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('no answer from the other instances')), PRESENCE_TIMEOUT_MS);
    });
    try {
      return (await Promise.race([this.server.in(userRoom(userId)).fetchSockets(), tooSlow])).length;
    } catch (error) {
      // Redis could not relay the question: count the devices on this instance.
      this.logger.warn(`Presence counted on this instance only: ${(error as Error).message}`);
      return this.server.adapter.rooms.get(userRoom(userId))?.size ?? 0;
    } finally {
      clearTimeout(timer);
    }
  }
}
