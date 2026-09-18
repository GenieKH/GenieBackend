import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WsJwtGuard } from './ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  
  // Track userId -> socketId
  private activeUsers = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  // Using the WsJwtGuard manually on connection since standard guards don't block the connection event itself
  // but we already have WsJwtGuard designed to be used on messages. 
  // For connection, we'll extract logic from the guard or use it in the events.
  
  // However, the prompt says: "handleConnection: run WsJwtGuard logic, track userId -> socketId in an in-memory map"
  // Let's implement the token extraction directly in handleConnection to drop invalid connections immediately.
  async handleConnection(client: Socket) {
    try {
      const guard = new WsJwtGuard();
      // The guard needs ExecutionContext. For handleConnection, it's easier to just call the verification directly,
      // but to reuse the guard we can simulate it or just do the verify here since it's simple.
      const token = this.extractToken(client);
      
      if (!token) {
        throw new Error('No token provided');
      }

      const jwt = require('jsonwebtoken');
      const publicKey = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, '\n') || '';
      const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as any;
      
      const userId = payload.sub;
      client.data.userId = userId;
      
      this.activeUsers.set(userId, client.id);
      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    } catch (error) {
      this.logger.warn(`Connection rejected: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      this.activeUsers.delete(userId);
      this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
    }
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { recipientId: string; ciphertext: string; nonce: string },
  ) {
    const senderId = client.data.userId;
    
    if (!payload.recipientId || !payload.ciphertext || !payload.nonce) {
      this.logger.warn(`Invalid sendMessage payload from ${senderId}`);
      return { status: 'error', message: 'Missing required fields' };
    }

    try {
      // 1. Persist the message in Postgres
      const savedMessage = await this.prisma.message.create({
        data: {
          senderId,
          recipientId: payload.recipientId,
          ciphertext: payload.ciphertext,
          nonce: payload.nonce,
        },
      });

      // 2. Check if recipient is online
      const recipientSocketId = this.activeUsers.get(payload.recipientId);
      if (recipientSocketId) {
        // 3. Emit newMessage to recipient
        this.server.to(recipientSocketId).emit('newMessage', savedMessage);
      }

      return { status: 'ok', messageId: savedMessage.id };
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      return { status: 'error', message: 'Failed to process message' };
    }
  }

  private extractToken(client: Socket): string | undefined {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }
    const token = client.handshake.query.token;
    return typeof token === 'string' ? token : undefined;
  }
}
