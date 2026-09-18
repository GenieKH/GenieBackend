import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async setPublicKey(userId: string, publicKey: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { identityPublicKey: publicKey },
    });
    return { success: true };
  }

  async getPublicKey(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { identityPublicKey: true },
    });
    
    if (!user || !user.identityPublicKey) {
      throw new NotFoundException('Public key not found for this user');
    }
    
    return { identityPublicKey: user.identityPublicKey };
  }

  async setBackup(userId: string, blob: string, salt: string, nonce: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        backupBlob: blob,
        backupSalt: salt,
        backupNonce: nonce,
      },
    });
    return { success: true };
  }

  async getBackup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        backupBlob: true,
        backupSalt: true,
        backupNonce: true,
      },
    });

    if (!user || !user.backupBlob || !user.backupSalt || !user.backupNonce) {
      throw new NotFoundException('No backup found'); // 404
    }

    return {
      backupBlob: user.backupBlob,
      backupSalt: user.backupSalt,
      backupNonce: user.backupNonce,
    };
  }

  async getMessagesAfter(userId: string, lastMessageTime: Date) {
    return this.prisma.message.findMany({
      where: {
        recipientId: userId,
        createdAt: {
          gt: lastMessageTime,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getConversations(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true, email: true, phone: true, avatarUrl: true } },
        recipient: { select: { id: true, username: true, email: true, phone: true, avatarUrl: true } },
      },
    });

    const conversationMap = new Map<string, any>();
    for (const msg of messages) {
      const partner = msg.senderId === userId ? msg.recipient : msg.sender;
      if (!partner) continue;
      const partnerId = partner.id;

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          participantId: partnerId,
          participantName: partner.username || partner.email || partner.phone || 'Property Owner',
          participantAvatar: partner.avatarUrl || null,
          lastMessage: {
            id: msg.id,
            ciphertext: msg.ciphertext,
            nonce: msg.nonce,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            readAt: msg.readAt,
          },
          unreadCount: 0,
        });
      }

      if (msg.recipientId === userId && !msg.readAt) {
        const conv = conversationMap.get(partnerId);
        conv.unreadCount += 1;
      }
    }

    return Array.from(conversationMap.values());
  }

  async getMessagesWith(userId: string, participantId: string, limit = 50, before?: string) {
    const whereClause: any = {
      OR: [
        { senderId: userId, recipientId: participantId },
        { senderId: participantId, recipientId: userId },
      ],
    };

    if (before) {
      whereClause.createdAt = { lt: new Date(before) };
    }

    return this.prisma.message.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markAsRead(userId: string, participantId: string) {
    await this.prisma.message.updateMany({
      where: {
        senderId: participantId,
        recipientId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
    return { success: true };
  }
}
