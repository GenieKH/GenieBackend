import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JsonCache } from '../redis/json-cache.service';
import { PUBLIC_KEY_TTL_SECONDS, publicKeyCacheKey } from './public-key-cache';

export interface Conversation {
  participantId: string;
  participantName: string;
  participantAvatar: string | null;
  lastMessage: {
    id: string;
    ciphertext: string;
    nonce: string;
    senderId: string;
    createdAt: Date;
    readAt: Date | null;
  };
  unreadCount: number;
}

/** The newest message of one conversation, as the query returns it. */
type LastMessageRow = Conversation['lastMessage'] & { partnerId: string };

/** An encrypted message as the sender's device submits it. */
export interface NewMessage {
  /** Chosen by the sender's device, so a retried send is not stored twice. */
  id?: string;
  recipientId: string;
  ciphertext: string;
  nonce: string;
}

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

/** A deactivated account is hidden from everyone else, as if it did not exist. */
const VISIBLE = { deactivatedAt: null } as const;

const DISPLAY_FIELDS = { name: true, username: true, email: true, phone: true, avatarUrl: true } as const;

type DisplayFields = {
  name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
};

/** The name a user chose, else their handle. */
function displayName(user: DisplayFields | null): string {
  return user?.name || user?.username || user?.email || user?.phone || 'Property Owner';
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: JsonCache,
  ) {}

  /**
   * Publishes a device's public key. Once the account has a PIN-protected
   * backup its key is fixed: a different one is refused here and can only come
   * in through "reset keys" with the current PIN (`ChatBackupService.save`).
   */
  async setPublicKey(userId: string, publicKey: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { identityPublicKey: true, keyBackup: { select: { userId: true } } },
    });
    if (user?.identityPublicKey === publicKey) return { success: true };
    if (user?.identityPublicKey && user.keyBackup) {
      throw new ConflictException('This account already has chat keys. Replacing them needs the backup PIN.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { identityPublicKey: publicKey },
    });
    await this.cache.delete(publicKeyCacheKey(userId));
    return { success: true };
  }

  /** Fetched every time a conversation opens. */
  getPublicKey(userId: string) {
    return this.cache.remember(publicKeyCacheKey(userId), PUBLIC_KEY_TTL_SECONDS, async () => {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, ...VISIBLE },
        select: { identityPublicKey: true },
      });
      if (!user || !user.identityPublicKey) {
        throw new NotFoundException('Public key not found for this user');
      }
      return { identityPublicKey: user.identityPublicKey };
    });
  }

  /** Called when the account is hidden, shown again or deleted. */
  async forgetPublicKey(userId: string): Promise<void> {
    await this.cache.delete(publicKeyCacheKey(userId));
  }

  /**
   * Stores an encrypted message and returns it with the sender's display info.
   * Sending the same `id` again returns the stored message instead of a duplicate.
   */
  async sendMessage(senderId: string, message: NewMessage) {
    if (message.recipientId === senderId) {
      throw new BadRequestException('You cannot message yourself');
    }

    if (!(await this.isVisible(message.recipientId))) {
      throw new NotFoundException('Recipient not found');
    }

    const saved = await this.createOrFindMessage(senderId, message);
    const { sender, ...stored } = saved;
    return { ...stored, senderName: displayName(sender), senderAvatar: sender.avatarUrl || null };
  }

  private async createOrFindMessage(senderId: string, message: NewMessage) {
    const include = { sender: { select: DISPLAY_FIELDS } };
    try {
      return await this.prisma.message.create({
        data: {
          id: message.id,
          senderId,
          recipientId: message.recipientId,
          ciphertext: message.ciphertext,
          nonce: message.nonce,
        },
        include,
      });
    } catch (error) {
      if (!message.id || (error as { code?: string }).code !== UNIQUE_CONSTRAINT_VIOLATION) {
        throw error;
      }
      // A retry of a message that was already stored.
      const existing = await this.prisma.message.findUnique({ where: { id: message.id }, include });
      if (!existing || existing.senderId !== senderId) {
        throw new ConflictException('Message id is already in use');
      }
      return existing;
    }
  }

  /**
   * One row per person the user has exchanged messages with, most recent
   * first. Only the last message of each conversation leaves the database.
   * Messages to oneself (possible in old versions) are not a conversation,
   * and a conversation with a deactivated account is not listed.
   */
  async getConversations(userId: string): Promise<Conversation[]> {
    const lastMessages = await this.prisma.$queryRaw<LastMessageRow[]>`
      SELECT DISTINCT ON (partner_id)
        partner_id AS "partnerId",
        id,
        sender_id AS "senderId",
        ciphertext,
        nonce,
        created_at AS "createdAt",
        read_at AS "readAt"
      FROM (
        SELECT m.*,
          CASE WHEN m.sender_id = ${userId}::uuid THEN m.recipient_id ELSE m.sender_id END AS partner_id
        FROM messages m
        WHERE (m.sender_id = ${userId}::uuid OR m.recipient_id = ${userId}::uuid)
          AND m.sender_id <> m.recipient_id
      ) conversation
      ORDER BY partner_id, created_at DESC`;
    if (lastMessages.length === 0) return [];

    const [partners, unread] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: lastMessages.map((row) => row.partnerId) }, ...VISIBLE },
        select: { id: true, ...DISPLAY_FIELDS },
      }),
      this.prisma.message.groupBy({
        by: ['senderId'],
        where: { recipientId: userId, readAt: null },
        _count: { _all: true },
      }),
    ]);
    const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
    const unreadBySender = new Map(unread.map((group) => [group.senderId, group._count._all]));

    return lastMessages
      .filter((row) => partnerById.has(row.partnerId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(({ partnerId, ...lastMessage }) => {
        const partner = partnerById.get(partnerId)!;
        return {
          participantId: partnerId,
          participantName: displayName(partner),
          participantAvatar: partner.avatarUrl || null,
          lastMessage,
          unreadCount: unreadBySender.get(partnerId) ?? 0,
        };
      });
  }

  /**
   * The newest `limit` messages of a conversation (older than `before`, when
   * given), returned oldest first so they can be shown top to bottom.
   */
  async getMessagesWith(userId: string, participantId: string, limit = 50, before?: string) {
    if (!(await this.isVisible(participantId))) return [];

    const newestFirst = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: participantId },
          { senderId: participantId, recipientId: userId },
        ],
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return newestFirst.reverse();
  }

  private async isVisible(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, ...VISIBLE }, select: { id: true } });
    return user !== null;
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
