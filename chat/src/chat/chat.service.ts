import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JsonCache, PrismaService } from '@genie/shared';
import { CHAT_PIN_TTL_SECONDS, chatPinCacheKey } from './chat-pin-cache';
import { ConversationStateService } from './conversation-state.service';
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
type LastMessageRow = Conversation['lastMessage'] & {
  partnerId: string;
  archivedAt: Date | null;
  clearedAt: Date | null;
};

/** Which of a user's conversations to list. */
export type ConversationList = 'main' | 'archived';

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

/**
 * Whether a conversation, as of its newest message, belongs in [list]. A
 * message newer than the archive or delete brings it back to the main list.
 */
function isInList(row: LastMessageRow, list: ConversationList): boolean {
  if (row.clearedAt && row.createdAt <= row.clearedAt) return false;
  const archived = row.archivedAt !== null && row.createdAt <= row.archivedAt;
  return list === 'archived' ? archived : !archived;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: JsonCache,
    private readonly states: ConversationStateService,
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

    await this.requireChatPin(senderId);

    if (!(await this.isVisible(message.recipientId))) {
      throw new NotFoundException('Recipient not found');
    }

    const saved = await this.createOrFindMessage(senderId, message);
    const { sender, ...stored } = saved;
    return { ...stored, senderName: displayName(sender), senderAvatar: sender.avatarUrl || null };
  }

  /**
   * Every account protects its chats with a chat PIN before it chats: the app
   * asks for one right after sign-in, and this stops a build that skips it.
   * A backup still locked with the account password does not count; nor does
   * none at all. One from before PIN tries were counted does.
   */
  private async requireChatPin(userId: string): Promise<void> {
    if (await this.cache.get<boolean>(chatPinCacheKey(userId))) return;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { backupBlob: true, keyBackup: { select: { protectedBy: true } } },
    });
    const hasPin = user?.keyBackup?.protectedBy === 'pin' || (!user?.keyBackup && !!user?.backupBlob);
    if (!hasPin) {
      throw new ForbiddenException('Create your chat PIN before sending messages.');
    }
    await this.cache.set(chatPinCacheKey(userId), true, CHAT_PIN_TTL_SECONDS);
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
   *
   * The work grows with the number of people, not of messages: the partners
   * are found by jumping from one to the next in the indexes (a "skip
   * scan"), then each conversation's last message is one index lookup per
   * direction. Needs the (recipient_id, sender_id) index of migration 13 to
   * jump through received messages; without it the answer is the same, only
   * slower.
   */
  /**
   * `main` leaves out conversations the user archived or deleted for
   * themselves; `archived` lists only the archived ones. Either comes back
   * to the main list when a newer message arrives.
   */
  async getConversations(userId: string, list: ConversationList = 'main'): Promise<Conversation[]> {
    const lastMessages = await this.prisma.$queryRaw<LastMessageRow[]>`
      WITH RECURSIVE sent AS (
        (SELECT recipient_id AS id FROM messages WHERE sender_id = ${userId}::uuid ORDER BY recipient_id LIMIT 1)
        UNION ALL
        SELECT (
          SELECT recipient_id FROM messages
          WHERE sender_id = ${userId}::uuid AND recipient_id > sent.id
          ORDER BY recipient_id LIMIT 1
        )
        FROM sent WHERE sent.id IS NOT NULL
      ), received AS (
        (SELECT sender_id AS id FROM messages WHERE recipient_id = ${userId}::uuid ORDER BY sender_id LIMIT 1)
        UNION ALL
        SELECT (
          SELECT sender_id FROM messages
          WHERE recipient_id = ${userId}::uuid AND sender_id > received.id
          ORDER BY sender_id LIMIT 1
        )
        FROM received WHERE received.id IS NOT NULL
      ), partners AS (
        SELECT id AS partner_id FROM sent WHERE id IS NOT NULL AND id <> ${userId}::uuid
        UNION
        SELECT id FROM received WHERE id IS NOT NULL AND id <> ${userId}::uuid
      )
      SELECT
        p.partner_id AS "partnerId",
        last.id,
        last.sender_id AS "senderId",
        last.ciphertext,
        last.nonce,
        last.created_at AS "createdAt",
        last.read_at AS "readAt",
        state.archived_at AS "archivedAt",
        state.cleared_at AS "clearedAt"
      FROM partners p
      LEFT JOIN chat_conversation_states state
        ON state.user_id = ${userId}::uuid AND state.partner_id = p.partner_id
      CROSS JOIN LATERAL (
        SELECT * FROM (
          (SELECT id, sender_id, ciphertext, nonce, created_at, read_at FROM messages
            WHERE sender_id = ${userId}::uuid AND recipient_id = p.partner_id
            ORDER BY created_at DESC LIMIT 1)
          UNION ALL
          (SELECT id, sender_id, ciphertext, nonce, created_at, read_at FROM messages
            WHERE sender_id = p.partner_id AND recipient_id = ${userId}::uuid
            ORDER BY created_at DESC LIMIT 1)
        ) both_directions
        ORDER BY created_at DESC
        LIMIT 1
      ) last`;
    const shown = lastMessages.filter((row) => isInList(row, list));
    if (shown.length === 0) return [];

    const [partners, unread] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: shown.map((row) => row.partnerId) }, ...VISIBLE },
        select: { id: true, ...DISPLAY_FIELDS },
      }),
      // Messages hidden by "delete for me" do not count as unread.
      this.prisma.$queryRaw<{ senderId: string; count: number }[]>`
        SELECT m.sender_id AS "senderId", count(*)::int AS count
        FROM messages m
        LEFT JOIN chat_conversation_states state
          ON state.user_id = ${userId}::uuid AND state.partner_id = m.sender_id
        WHERE m.recipient_id = ${userId}::uuid
          AND m.read_at IS NULL
          AND (state.cleared_at IS NULL OR m.created_at > state.cleared_at)
        GROUP BY m.sender_id`,
    ]);
    const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
    const unreadBySender = new Map(unread.map((group) => [group.senderId, group.count]));

    return shown
      .filter((row) => partnerById.has(row.partnerId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(({ partnerId, archivedAt: _archivedAt, clearedAt: _clearedAt, ...lastMessage }) => {
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

    // "Delete for me" hides everything up to that moment.
    const clearedAt = await this.states.clearedAt(userId, participantId);
    const newestFirst = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: participantId },
          { senderId: participantId, recipientId: userId },
        ],
        ...((before || clearedAt) && {
          createdAt: {
            ...(before && { lt: new Date(before) }),
            ...(clearedAt && { gt: clearedAt }),
          },
        }),
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
