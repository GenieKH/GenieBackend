import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const messageTable = { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() };
  const userTable = { findUnique: jest.fn(), findMany: jest.fn() };
  const prisma = { message: messageTable, user: userTable, $queryRaw: jest.fn() };
  let service: ChatService;

  const sender = { username: 'Dara', email: null, phone: null, avatarUrl: null };
  const stored = {
    id: 'm-1',
    senderId: 'alice',
    recipientId: 'bob',
    ciphertext: 'cipher',
    nonce: 'nonce',
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    sender,
  };
  const newMessage = { id: 'm-1', recipientId: 'bob', ciphertext: 'cipher', nonce: 'nonce' };

  beforeEach(() => {
    jest.clearAllMocks();
    userTable.findUnique.mockResolvedValue({ id: 'bob' });
    messageTable.create.mockResolvedValue(stored);
    service = new ChatService(prisma as never);
  });

  describe('sendMessage', () => {
    it('stores the ciphertext under the id the device chose', async () => {
      const message = await service.sendMessage('alice', newMessage);

      expect(messageTable.create.mock.calls[0][0].data).toEqual({
        id: 'm-1',
        senderId: 'alice',
        recipientId: 'bob',
        ciphertext: 'cipher',
        nonce: 'nonce',
      });
      expect(message).toMatchObject({ id: 'm-1', senderId: 'alice', senderName: 'Dara', senderAvatar: null });
      expect(message).not.toHaveProperty('sender');
    });

    it('returns the stored message when the same id is sent again', async () => {
      messageTable.create.mockRejectedValue({ code: 'P2002' });
      messageTable.findUnique.mockResolvedValue(stored);

      const message = await service.sendMessage('alice', newMessage);

      expect(message.id).toBe('m-1');
      expect(messageTable.create).toHaveBeenCalledTimes(1);
    });

    it("refuses an id that belongs to someone else's message", async () => {
      messageTable.create.mockRejectedValue({ code: 'P2002' });
      messageTable.findUnique.mockResolvedValue({ ...stored, senderId: 'mallory' });

      await expect(service.sendMessage('alice', newMessage)).rejects.toThrow(ConflictException);
    });

    it('rejects an unknown recipient without storing anything', async () => {
      userTable.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage('alice', newMessage)).rejects.toThrow(NotFoundException);
      expect(messageTable.create).not.toHaveBeenCalled();
    });

    it('rejects a message to yourself', async () => {
      await expect(service.sendMessage('bob', newMessage)).rejects.toThrow(BadRequestException);
      expect(messageTable.create).not.toHaveBeenCalled();
    });

    it('does not hide unexpected database errors', async () => {
      messageTable.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.sendMessage('alice', newMessage)).rejects.toThrow('connection lost');
    });
  });

  describe('getConversations', () => {
    const row = (partnerId: string, createdAt: string) => ({
      partnerId,
      id: `last-${partnerId}`,
      senderId: partnerId,
      ciphertext: 'cipher',
      nonce: 'nonce',
      createdAt: new Date(createdAt),
      readAt: null,
    });

    it('returns one row per partner, newest conversation first, with unread counts', async () => {
      prisma.$queryRaw.mockResolvedValue([row('bob', '2026-01-01T10:00:00Z'), row('carol', '2026-01-02T10:00:00Z')]);
      userTable.findMany.mockResolvedValue([
        { id: 'bob', username: 'Bob', email: null, phone: null, avatarUrl: 'bob.png' },
        { id: 'carol', username: null, email: null, phone: null, avatarUrl: null },
      ]);
      messageTable.groupBy.mockResolvedValue([{ senderId: 'bob', _count: { _all: 3 } }]);

      const conversations = await service.getConversations('alice');

      expect(conversations).toEqual([
        {
          participantId: 'carol',
          participantName: 'Property Owner',
          participantAvatar: null,
          lastMessage: expect.objectContaining({ id: 'last-carol', senderId: 'carol', ciphertext: 'cipher' }),
          unreadCount: 0,
        },
        {
          participantId: 'bob',
          participantName: 'Bob',
          participantAvatar: 'bob.png',
          lastMessage: expect.objectContaining({ id: 'last-bob' }),
          unreadCount: 3,
        },
      ]);
      expect(conversations[0].lastMessage).not.toHaveProperty('partnerId');
      expect(messageTable.groupBy.mock.calls[0][0].where).toEqual({ recipientId: 'alice', readAt: null });
    });

    it('asks for nothing more when the user has no messages', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      expect(await service.getConversations('alice')).toEqual([]);
      expect(userTable.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getMessagesWith', () => {
    it('returns the newest page, oldest message first', async () => {
      messageTable.findMany.mockResolvedValue([{ id: 'newest' }, { id: 'middle' }, { id: 'oldest' }]);

      const page = await service.getMessagesWith('alice', 'bob', 3);

      expect(page.map((m) => m.id)).toEqual(['oldest', 'middle', 'newest']);
      expect(messageTable.findMany.mock.calls[0][0]).toMatchObject({ orderBy: { createdAt: 'desc' }, take: 3 });
    });

    it('only reads the conversation between the two users', async () => {
      messageTable.findMany.mockResolvedValue([]);

      await service.getMessagesWith('alice', 'bob', 50, '2026-01-01T00:00:00Z');

      expect(messageTable.findMany.mock.calls[0][0].where).toEqual({
        OR: [
          { senderId: 'alice', recipientId: 'bob' },
          { senderId: 'bob', recipientId: 'alice' },
        ],
        createdAt: { lt: new Date('2026-01-01T00:00:00Z') },
      });
    });
  });
});
