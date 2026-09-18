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
}
